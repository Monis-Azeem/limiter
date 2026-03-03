package com.boundly.app.enforcement

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class UsageStatsCollector(
  private val context: Context,
  private val policyStore: BoundlyPolicyStore = BoundlyPolicyStore(context)
) {
  data class Snapshot(
    val minutesByPackage: Map<String, Int>,
    val opensByPackage: Map<String, Int>
  )

  data class UsageEventRecord(
    val id: String,
    val targetPackage: String,
    val occurredAtIso: String,
    val eventType: String,
    val minutesDelta: Int,
    val opensDelta: Int
  )

  fun collectDailySnapshot(targetPackages: Set<String>): Snapshot {
    if (targetPackages.isEmpty()) {
      return Snapshot(emptyMap(), emptyMap())
    }

    val dayIso = LocalDate.now().toString()
    policyStore.clearSetupBaselinesForDay(dayIso)
    policyStore.clearFallbackUsageForDay(dayIso)

    return runCatching {
      collectSnapshotFromUsageStats(targetPackages, dayIso)
    }.getOrElse { error ->
      policyStore.appendDebugLog(
        "UsageStats unavailable, using fallback counters: ${error.message ?: error.javaClass.simpleName}"
      )
      val minutesByPackage = targetPackages.associateWith { targetPackage ->
        policyStore.getFallbackMinutesForDay(dayIso, targetPackage)
      }
      val opensByPackage = targetPackages.associateWith { 0 }
      Snapshot(minutesByPackage, opensByPackage)
    }
  }

  fun collectRawDailyMinutes(targetPackages: Set<String>): Map<String, Int> {
    if (targetPackages.isEmpty()) {
      return emptyMap()
    }

    return runCatching {
      val now = Instant.now().toEpochMilli()
      val startOfDay = LocalDate.now()
        .atStartOfDay(ZoneId.systemDefault())
        .toInstant()
        .toEpochMilli()
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val aggregateUsage = usageStatsManager.queryAndAggregateUsageStats(startOfDay, now)
      targetPackages.associateWith { targetPackage ->
        ((aggregateUsage[targetPackage]?.totalTimeInForeground ?: 0L) / 60_000L).toInt().coerceAtLeast(0)
      }
    }.getOrElse {
      val dayIso = LocalDate.now().toString()
      targetPackages.associateWith { targetPackage ->
        policyStore.getFallbackMinutesForDay(dayIso, targetPackage)
      }
    }
  }

  private fun collectSnapshotFromUsageStats(targetPackages: Set<String>, dayIso: String): Snapshot {
    val now = Instant.now().toEpochMilli()
    val startOfDay = LocalDate.now()
      .atStartOfDay(ZoneId.systemDefault())
      .toInstant()
      .toEpochMilli()

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val aggregateUsage = usageStatsManager.queryAndAggregateUsageStats(startOfDay, now)

    val usageMillisByPackage = mutableMapOf<String, Long>()
    val foregroundStartByPackage = mutableMapOf<String, Long>()

    val usageEvents = usageStatsManager.queryEvents(startOfDay, now)
    val event = UsageEvents.Event()
    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (!targetPackages.contains(packageName)) {
        continue
      }

      if (isForegroundEvent(event.eventType)) {
        foregroundStartByPackage[packageName] = event.timeStamp
        continue
      }

      if (isBackgroundEvent(event.eventType)) {
        val start = foregroundStartByPackage.remove(packageName) ?: continue
        val duration = (event.timeStamp - start).coerceAtLeast(0L)
        usageMillisByPackage[packageName] = (usageMillisByPackage[packageName] ?: 0L) + duration
      }
    }

    foregroundStartByPackage.forEach { (packageName, start) ->
      val duration = (now - start).coerceAtLeast(0L)
      usageMillisByPackage[packageName] = (usageMillisByPackage[packageName] ?: 0L) + duration
    }

    val minutesByPackage = mutableMapOf<String, Int>()
    val opensByPackage = mutableMapOf<String, Int>()
    for (targetPackage in targetPackages) {
      val aggregateMinutes = ((aggregateUsage[targetPackage]?.totalTimeInForeground ?: 0L) / 60_000L).toInt()
      val eventMinutes = ((usageMillisByPackage[targetPackage] ?: 0L) / 60_000L).toInt()
      val rawMinutes = maxOf(aggregateMinutes, eventMinutes).coerceAtLeast(0)
      val baselineMinutes = policyStore.getOrCreateSetupBaselineMinutes(dayIso, targetPackage, rawMinutes)
      minutesByPackage[targetPackage] = (rawMinutes - baselineMinutes).coerceAtLeast(0)
      opensByPackage[targetPackage] = 0
    }

    return Snapshot(minutesByPackage, opensByPackage)
  }

  fun collectUsageEventsSince(sinceIso: String?, targetPackages: Set<String>): List<UsageEventRecord> {
    // Open-count telemetry is deprecated for v1.1.x; keep contract compatibility.
    return emptyList()
  }

  fun getLikelyForegroundPackage(targetPackages: Set<String>): String? {
    if (targetPackages.isEmpty()) {
      return null
    }

    return runCatching {
      val now = Instant.now().toEpochMilli()
      val windowStart = now - (2 * 60_000L)
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, windowStart, now)
      stats
        .asSequence()
        .filter { stat -> targetPackages.contains(stat.packageName) }
        .maxByOrNull { stat -> stat.lastTimeUsed }
        ?.packageName
    }.getOrNull()
  }

  private fun isForegroundEvent(eventType: Int): Boolean {
    return eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
      eventType == UsageEvents.Event.ACTIVITY_RESUMED
  }

  private fun isBackgroundEvent(eventType: Int): Boolean {
    return eventType == UsageEvents.Event.MOVE_TO_BACKGROUND ||
      eventType == UsageEvents.Event.ACTIVITY_PAUSED ||
      eventType == UsageEvents.Event.ACTIVITY_STOPPED
  }
}
