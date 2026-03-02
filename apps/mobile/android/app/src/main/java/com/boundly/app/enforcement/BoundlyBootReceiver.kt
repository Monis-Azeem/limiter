package com.boundly.app.enforcement

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BoundlyBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) {
      return
    }

    val policyStore = BoundlyPolicyStore(context)
    if (policyStore.isEnforcementEnabled()) {
      policyStore.appendDebugLog("Boot completed, restarting enforcement")
      BoundlyForegroundService.start(context)
    }
  }
}
