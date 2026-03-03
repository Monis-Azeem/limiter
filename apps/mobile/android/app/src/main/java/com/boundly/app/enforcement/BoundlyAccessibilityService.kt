package com.boundly.app.enforcement

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import java.time.LocalDate

class BoundlyAccessibilityService : AccessibilityService() {
  private val policyStore by lazy { BoundlyPolicyStore(this) }
  private var lastInterventionAtMs = 0L
  private var lastHomeActionAtMs = 0L
  private var lastObservedPackage: String? = null
  private var lastObservedAtMs = 0L

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

      if (!policyStore.isEnforcementEnabled()) {
        lastObservedPackage = packageName
        lastObservedAtMs = nowMs
        return
      }

      trackFallbackUsage(packageName, nowMs)

      if (packageName == applicationContext.packageName || packageName == "com.android.systemui") {
        return
      }

      val blockedPackages = policyStore.getBlockedPackages()
      if (!blockedPackages.contains(packageName)) {
        return
      }

      if (nowMs - lastInterventionAtMs < LOCK_INTERVENTION_COOLDOWN_MS) {
        return
      }

      lastInterventionAtMs = nowMs
      performHomeAction(nowMs)
      policyStore.appendDebugLog("Blocked launch intercepted: $packageName")
      launchLockScreen(packageName)
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

  private fun trackFallbackUsage(packageName: String, nowMs: Long) {
    val previousPackage = lastObservedPackage
    val previousAtMs = lastObservedAtMs
    if (!previousPackage.isNullOrBlank() && previousPackage != packageName && previousAtMs > 0L) {
      val managedPackages = policyStore.getManagedPackages()
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
    val managedPackages = policyStore.getManagedPackages()
    if (!managedPackages.contains(previousPackage)) {
      return
    }
    val elapsedSeconds = ((nowMs - lastObservedAtMs).coerceAtLeast(0L) / 1000L)
    if (elapsedSeconds > 0L) {
      policyStore.addFallbackUsageSeconds(LocalDate.now().toString(), previousPackage, elapsedSeconds)
    }
  }

  private fun performHomeAction(nowMs: Long) {
    if (nowMs - lastHomeActionAtMs < HOME_ACTION_COOLDOWN_MS) {
      return
    }
    runCatching {
      performGlobalAction(GLOBAL_ACTION_HOME)
      lastHomeActionAtMs = nowMs
    }.onFailure { error ->
      policyStore.appendDebugLog("Home action failed: ${error.message ?: error.toString()}")
    }
  }

  private fun launchLockScreen(blockedPackage: String) {
    runCatching {
      val intent = Intent(this, BoundlyLockActivity::class.java).apply {
        putExtra(BoundlyLockActivity.EXTRA_BLOCKED_PACKAGE, blockedPackage)
        putExtra(
          BoundlyLockActivity.EXTRA_BLOCK_REASON,
          policyStore.getBlockedReason(blockedPackage) ?: "Daily limit reached"
        )
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
      startActivity(intent)
    }.onFailure { error ->
      policyStore.setLastAccessibilityError(error.message ?: error.toString())
      Log.e(TAG, "Failed to launch lock screen", error)
    }
  }

  companion object {
    private const val TAG = "BoundlyAccessibility"
    private const val LOCK_INTERVENTION_COOLDOWN_MS = 1_300L
    private const val HOME_ACTION_COOLDOWN_MS = 900L
  }
}
