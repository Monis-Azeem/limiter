package com.boundly.app.enforcement

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BoundlyServiceRestartReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != BoundlyForegroundService.ACTION_RESTART) {
      return
    }

    val policyStore = BoundlyPolicyStore(context)
    if (!policyStore.isEnforcementEnabled()) {
      policyStore.appendDebugLog("Restart receiver skipped: enforcement disabled")
      return
    }

    policyStore.appendDebugLog("Restart receiver triggered: starting foreground service")
    BoundlyForegroundService.start(context)
  }
}
