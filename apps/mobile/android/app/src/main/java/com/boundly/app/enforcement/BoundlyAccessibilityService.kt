package com.boundly.app.enforcement

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class BoundlyAccessibilityService : AccessibilityService() {
  private val policyStore by lazy { BoundlyPolicyStore(this) }
  private var lastLaunchTimeMs = 0L

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
      if (packageName == applicationContext.packageName) {
        return
      }

      if (!policyStore.isEnforcementEnabled()) {
        return
      }

      val blockedPackages = policyStore.getBlockedPackages()
      if (!blockedPackages.contains(packageName)) {
        return
      }

      val now = SystemClock.elapsedRealtime()
      if (now - lastLaunchTimeMs < 1000L) {
        return
      }

      lastLaunchTimeMs = now
      policyStore.appendDebugLog("Blocked app launch detected: $packageName")
      launchLockScreen(packageName)
    } catch (error: Exception) {
      policyStore.setLastAccessibilityError(error.message ?: error.toString())
      Log.e(TAG, "Accessibility event handling failed", error)
    }
  }

  override fun onInterrupt() {
    policyStore.setLastAccessibilityError("Accessibility service interrupted by system")
    policyStore.appendDebugLog("Accessibility service interrupted")
    Log.w(TAG, "Accessibility service interrupted")
  }

  private fun launchLockScreen(blockedPackage: String) {
    runCatching {
      val intent = Intent(this, BoundlyLockActivity::class.java).apply {
        putExtra(BoundlyLockActivity.EXTRA_BLOCKED_PACKAGE, blockedPackage)
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
  }
}
