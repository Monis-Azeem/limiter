package com.boundly.app.enforcement

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

class UsageStatsCollector(private val context: Context) {
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

    val now = Instant.now().toEpochMilli()
    val startOfDay = LocalDate.now()
      .atStartOfDay(ZoneId.systemDefault())
      .toInstant()
      .toEpochMilli()

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val aggregateUsage = usageStatsManager.queryAndAggregateUsageStats(startOfDay, now)

    val usageMillisByPackage = mutableMapOf<String, Long>()
    val opensByPackage = mutableMapOf<String, Int>()
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
        if (!foregroundStartByPackage.containsKey(packageName)) {
          opensByPackage[packageName] = (opensByPackage[packageName] ?: 0) + 1
        }
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
    for (targetPackage in targetPackages) {
      val aggregateMinutes = ((aggregateUsage[targetPackage]?.totalTimeInForeground ?: 0L) / 60_000L).toInt()
      val eventMinutes = ((usageMillisByPackage[targetPackage] ?: 0L) / 60_000L).toInt()
      minutesByPackage[targetPackage] = maxOf(aggregateMinutes, eventMinutes)
    }

    return Snapshot(minutesByPackage, opensByPackage)
  }

  fun collectUsageEventsSince(sinceIso: String?, targetPackages: Set<String>): List<UsageEventRecord> {
    if (targetPackages.isEmpty()) {
      return emptyList()
    }

    val now = Instant.now().toEpochMilli()
    val sinceMillis = runCatching { sinceIso?.let { Instant.parse(it).toEpochMilli() } }
      .getOrNull() ?: (now - 15 * 60_000L)

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val usageEvents = usageStatsManager.queryEvents(sinceMillis, now)
    val event = UsageEvents.Event()
    val records = mutableListOf<UsageEventRecord>()

    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (!targetPackages.contains(packageName)) {
        continue
      }

      if (isForegroundEvent(event.eventType)) {
        records.add(
          UsageEventRecord(
            id = UUID.randomUUID().toString(),
            targetPackage = packageName,
            occurredAtIso = Instant.ofEpochMilli(event.timeStamp).toString(),
            eventType = "open",
            minutesDelta = 0,
            opensDelta = 1
          )
        )
      }
    }

    return records
  }

  fun getLikelyForegroundPackage(targetPackages: Set<String>): String? {
    if (targetPackages.isEmpty()) {
      return null
    }

    val now = Instant.now().toEpochMilli()
    val windowStart = now - (2 * 60_000L)
    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, windowStart, now)
    return stats
      .asSequence()
      .filter { stat -> targetPackages.contains(stat.packageName) }
      .maxByOrNull { stat -> stat.lastTimeUsed }
      ?.packageName
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
