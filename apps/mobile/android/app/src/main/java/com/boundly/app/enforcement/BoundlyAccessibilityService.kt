package com.boundly.app.enforcement

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import java.time.LocalDate

class BoundlyAccessibilityService : AccessibilityService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val policyStore by lazy { BoundlyPolicyStore(this) }
  private val usageStatsCollector by lazy { UsageStatsCollector(this, policyStore) }
  private val policyEvaluator by lazy {
    BoundlyPolicyEvaluator(policyStore, usageStatsCollector, applicationContext.packageName)
  }

  private var lastInterventionAtMs = 0L
  private var lastHomeActionAtMs = 0L
  private var lastObservedPackage: String? = null
  private var lastObservedAtMs = 0L
  private var lastPolicySyncAtMs = 0L
  private var cachedBlockedReasons: Map<String, String> = emptyMap()
  private var lastEnforcementEnabled = false
  private var fallbackTickerRunning = false
  private val fallbackTicker = object : Runnable {
    override fun run() {
      if (!policyStore.isEnforcementEnabled()) {
        fallbackTickerRunning = false
        return
      }

      val nowMs = SystemClock.elapsedRealtime()
      val packageName = lastObservedPackage
      if (!packageName.isNullOrBlank()) {
        val managedPackages = policyEvaluator.parseManagedPackages()
        if (managedPackages.contains(packageName)) {
          val elapsedSeconds = ((nowMs - lastObservedAtMs).coerceAtLeast(0L) / 1000L)
          if (elapsedSeconds > 0L) {
            policyStore.addFallbackUsageSeconds(LocalDate.now().toString(), packageName, elapsedSeconds)
            lastObservedAtMs = nowMs
          }
        } else {
          lastObservedAtMs = nowMs
        }
      }

      mainHandler.postDelayed(this, FALLBACK_TICK_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    runCatching {
      val info = serviceInfo
      info.flags = info.flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
        info.flags = info.flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
      }
      serviceInfo = info
      policyStore.clearLastAccessibilityError()
      policyStore.appendDebugLog("Accessibility service connected")

      if (policyStore.isEnforcementEnabled()) {
        BoundlyForegroundService.start(this)
        refreshBlockedPolicies(SystemClock.elapsedRealtime(), force = true)
        ensureFallbackTicker()
      }

      Log.i(TAG, "Accessibility service connected")
    }.onFailure { error ->
      policyStore.setLastAccessibilityError(error.message ?: error.toString())
      Log.e(TAG, "Accessibility service connection failed", error)
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    try {
      if (event == null) {
        return
      }

      if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
        event.eventType != AccessibilityEvent.TYPE_WINDOWS_CHANGED
      ) {
        return
      }

      val packageName = event.packageName?.toString() ?: return
      val nowMs = SystemClock.elapsedRealtime()

      val enforcementEnabled = policyStore.isEnforcementEnabled()
      if (!enforcementEnabled) {
        lastEnforcementEnabled = false
        lastObservedPackage = packageName
        lastObservedAtMs = nowMs
        return
      }

      if (!lastEnforcementEnabled) {
        lastEnforcementEnabled = true
        lastObservedPackage = packageName
        lastObservedAtMs = nowMs
        ensureFallbackTicker()
      } else {
        trackFallbackUsage(packageName, nowMs)
      }

      if (packageName == applicationContext.packageName || packageName == "com.android.systemui") {
        return
      }

      refreshBlockedPolicies(nowMs, force = false)
      val blockReason = cachedBlockedReasons[packageName] ?: policyStore.getBlockedReason(packageName)
      if (blockReason.isNullOrBlank()) {
        return
      }

      if (nowMs - lastInterventionAtMs < LOCK_INTERVENTION_COOLDOWN_MS) {
        return
      }

      lastInterventionAtMs = nowMs
      policyStore.appendDebugLog("Blocked launch intercepted: $packageName")
      performGlobalAction(GLOBAL_ACTION_HOME)
      launchLockScreenDelayed(packageName, blockReason)
    } catch (error: Exception) {
      policyStore.setLastAccessibilityError(error.message ?: error.toString())
      Log.e(TAG, "Accessibility event handling failed", error)
    }
  }

  override fun onInterrupt() {
    flushObservedUsage(SystemClock.elapsedRealtime())
    policyStore.setLastAccessibilityError("Accessibility service interrupted by system")
    policyStore.appendDebugLog("Accessibility service interrupted")
    Log.w(TAG, "Accessibility service interrupted")
  }

  private fun refreshBlockedPolicies(nowMs: Long, force: Boolean) {
    if (!force && nowMs - lastPolicySyncAtMs < POLICY_SYNC_COOLDOWN_MS) {
      return
    }

    runCatching {
      val blockedReasons = policyEvaluator.evaluateBlockedReasonMapNow()
      policyStore.setBlockedPackages(blockedReasons.keys, blockedReasons)
      cachedBlockedReasons = blockedReasons
      lastPolicySyncAtMs = nowMs
    }.onFailure { error ->
      policyStore.appendDebugLog("Policy refresh failed in accessibility: ${error.message ?: error.toString()}")
    }
  }

  private fun trackFallbackUsage(packageName: String, nowMs: Long) {
    val previousPackage = lastObservedPackage
    val previousAtMs = lastObservedAtMs
    if (!previousPackage.isNullOrBlank() && previousPackage != packageName && previousAtMs > 0L) {
      val managedPackages = policyEvaluator.parseManagedPackages()
      if (managedPackages.contains(previousPackage)) {
        val elapsedSeconds = ((nowMs - previousAtMs).coerceAtLeast(0L) / 1000L)
        if (elapsedSeconds > 0L) {
          policyStore.addFallbackUsageSeconds(LocalDate.now().toString(), previousPackage, elapsedSeconds)
        }
      }
    }
    lastObservedPackage = packageName
    lastObservedAtMs = nowMs
  }

  private fun flushObservedUsage(nowMs: Long) {
    val previousPackage = lastObservedPackage ?: return
    val managedPackages = policyEvaluator.parseManagedPackages()
    if (!managedPackages.contains(previousPackage)) {
      return
    }
    val elapsedSeconds = ((nowMs - lastObservedAtMs).coerceAtLeast(0L) / 1000L)
    if (elapsedSeconds > 0L) {
      policyStore.addFallbackUsageSeconds(LocalDate.now().toString(), previousPackage, elapsedSeconds)
    }
  }

  private fun launchLockScreen(blockedPackage: String, reason: String) {
    if (blockedPackage == applicationContext.packageName) {
      return
    }

    runCatching {
      val intent = Intent(this, BoundlyLockActivity::class.java).apply {
        putExtra(BoundlyLockActivity.EXTRA_BLOCKED_PACKAGE, blockedPackage)
        putExtra(BoundlyLockActivity.EXTRA_BLOCK_REASON, reason)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
      startActivity(intent)
    }.onFailure { error ->
      policyStore.setLastAccessibilityError(error.message ?: error.toString())
      Log.e(TAG, "Failed to launch lock screen", error)
    }
  }

  private fun launchLockScreenDelayed(blockedPackage: String, reason: String) {
    mainHandler.postDelayed(
      { launchLockScreen(blockedPackage, reason) },
      LOCK_SCREEN_DELAY_MS
    )
  }

  private fun ensureFallbackTicker() {
    if (fallbackTickerRunning) {
      return
    }
    fallbackTickerRunning = true
    mainHandler.postDelayed(fallbackTicker, FALLBACK_TICK_MS)
  }

  companion object {
    private const val TAG = "BoundlyAccessibility"
    private const val LOCK_INTERVENTION_COOLDOWN_MS = 1_300L
    private const val POLICY_SYNC_COOLDOWN_MS = 1_000L
    private const val LOCK_SCREEN_DELAY_MS = 200L
    private const val FALLBACK_TICK_MS = 2_000L
  }
}
