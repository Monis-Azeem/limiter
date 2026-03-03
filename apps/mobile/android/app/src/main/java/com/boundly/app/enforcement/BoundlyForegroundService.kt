package com.boundly.app.enforcement

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.boundly.app.R
import java.time.Instant

class BoundlyForegroundService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var policyStore: BoundlyPolicyStore
  private lateinit var policyEvaluator: BoundlyPolicyEvaluator
  private lateinit var usageStatsCollector: UsageStatsCollector
  private var stopRequested = false
  private var lastLoggedBlockedCount = -1

  private val evaluateRunnable = object : Runnable {
    override fun run() {
      try {
        if (!policyStore.isEnforcementEnabled()) {
          policyStore.clearBlockedPackages()
          policyStore.setLastHeartbeatIso(Instant.now().toString())
          handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
          return
        }

        val blockedReasons = policyEvaluator.evaluateBlockedReasonMapNow()
        val blockedPackages = blockedReasons.keys
        policyStore.setBlockedPackages(blockedPackages, blockedReasons)
        policyStore.setLastHeartbeatIso(Instant.now().toString())
        if (blockedPackages.size != lastLoggedBlockedCount) {
          policyStore.appendDebugLog("Watchdog heartbeat: blocked=${blockedPackages.size}")
          lastLoggedBlockedCount = blockedPackages.size
        }
      } catch (error: Exception) {
        policyStore.appendDebugLog("Foreground service error: ${error.message ?: error.toString()}")
      }

      handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    policyStore = BoundlyPolicyStore(this)
    usageStatsCollector = UsageStatsCollector(this, policyStore)
    policyEvaluator = BoundlyPolicyEvaluator(policyStore, usageStatsCollector, packageName)
    policyStore.appendDebugLog("Foreground service created")
    ensureNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopRequested = true
      policyStore.appendDebugLog("Foreground service stop requested")
      stopSelf()
      return START_NOT_STICKY
    }

    stopRequested = false
    policyStore.appendDebugLog("Foreground service started")
    startForeground(NOTIFICATION_ID, buildNotification())
    handler.removeCallbacks(evaluateRunnable)
    handler.post(evaluateRunnable)

    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    policyStore.appendDebugLog("Foreground service task removed from recents")
    scheduleServiceRestart("task_removed")
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    policyStore.appendDebugLog("Foreground service destroyed")
    handler.removeCallbacks(evaluateRunnable)
    scheduleServiceRestart("service_destroyed")
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

  private fun scheduleServiceRestart(reason: String) {
    if (stopRequested || !policyStore.isEnforcementEnabled()) {
      policyStore.appendDebugLog("Skip restart schedule ($reason): enforcement disabled or stop requested")
      return
    }

    runCatching {
      val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val restartIntent = Intent(this, BoundlyServiceRestartReceiver::class.java).apply {
        action = ACTION_RESTART
      }
      val pendingIntent = PendingIntent.getBroadcast(
        this,
        RESTART_REQUEST_CODE,
        restartIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val triggerAtMs = SystemClock.elapsedRealtime() + RESTART_DELAY_MS
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.ELAPSED_REALTIME_WAKEUP,
          triggerAtMs,
          pendingIntent
        )
      } else {
        alarmManager.setExact(
          AlarmManager.ELAPSED_REALTIME_WAKEUP,
          triggerAtMs,
          pendingIntent
        )
      }
      policyStore.appendDebugLog("Scheduled service restart in ${RESTART_DELAY_MS}ms ($reason)")
    }.onFailure { error ->
      policyStore.appendDebugLog("Failed to schedule service restart ($reason): ${error.message ?: error.toString()}")
    }
  }

  companion object {
    private const val CHANNEL_ID = "boundly_enforcement_channel"
    private const val NOTIFICATION_ID = 4401
    private const val HEARTBEAT_INTERVAL_MS = 3_500L
    private const val RESTART_DELAY_MS = 1_500L
    private const val RESTART_REQUEST_CODE = 4417
    const val ACTION_START = "com.boundly.app.enforcement.START"
    const val ACTION_STOP = "com.boundly.app.enforcement.STOP"
    const val ACTION_RESTART = "com.boundly.app.enforcement.RESTART"

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
