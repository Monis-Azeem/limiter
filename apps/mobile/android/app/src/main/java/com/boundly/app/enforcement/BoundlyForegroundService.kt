package com.boundly.app.enforcement

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.boundly.app.R
import java.time.Instant

class BoundlyForegroundService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var policyStore: BoundlyPolicyStore
  private lateinit var policyEvaluator: BoundlyPolicyEvaluator

  private val evaluateRunnable = object : Runnable {
    override fun run() {
      if (!policyStore.isEnforcementEnabled()) {
        policyStore.clearBlockedPackages()
        policyStore.setLastHeartbeatIso(Instant.now().toString())
        handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        return
      }

      val blockedPackages = policyEvaluator.evaluateBlockedPackagesNow()
      policyStore.setBlockedPackages(blockedPackages)
      policyStore.setLastHeartbeatIso(Instant.now().toString())

      handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    policyStore = BoundlyPolicyStore(this)
    policyEvaluator = BoundlyPolicyEvaluator(policyStore, UsageStatsCollector(this))
    ensureNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(NOTIFICATION_ID, buildNotification())
    handler.removeCallbacks(evaluateRunnable)
    handler.post(evaluateRunnable)

    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(evaluateRunnable)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Boundly Enforcement",
      NotificationManager.IMPORTANCE_LOW
    )
    channel.description = "Maintains app usage enforcement rules"
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Boundly enforcement active")
      .setContentText("Blocking restricted apps in the background")
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "boundly_enforcement_channel"
    private const val NOTIFICATION_ID = 4401
    private const val HEARTBEAT_INTERVAL_MS = 30_000L
    const val ACTION_START = "com.boundly.app.enforcement.START"
    const val ACTION_STOP = "com.boundly.app.enforcement.STOP"

    fun start(context: Context) {
      val intent = Intent(context, BoundlyForegroundService::class.java).apply {
        action = ACTION_START
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, BoundlyForegroundService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }
}
