package com.boundly.app.enforcement

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

class BoundlyAccessibilityService : AccessibilityService() {
  private lateinit var policyStore: BoundlyPolicyStore
  private var lastLaunchTimeMs = 0L

  override fun onServiceConnected() {
    super.onServiceConnected()
    policyStore = BoundlyPolicyStore(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
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
    launchLockScreen(packageName)
  }

  override fun onInterrupt() {
    // No-op
  }

  private fun launchLockScreen(blockedPackage: String) {
    val intent = Intent(this, BoundlyLockActivity::class.java).apply {
      putExtra(BoundlyLockActivity.EXTRA_BLOCKED_PACKAGE, blockedPackage)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    startActivity(intent)
  }
}
