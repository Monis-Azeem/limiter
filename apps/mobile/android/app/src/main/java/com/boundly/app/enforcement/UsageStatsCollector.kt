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

    val minutesByPackage = mutableMapOf<String, Int>()
    for (targetPackage in targetPackages) {
      val minutes = ((aggregateUsage[targetPackage]?.totalTimeInForeground ?: 0L) / 60_000L).toInt()
      minutesByPackage[targetPackage] = minutes
    }

    val opensByPackage = mutableMapOf<String, Int>()
    val usageEvents = usageStatsManager.queryEvents(startOfDay, now)
    val event = UsageEvents.Event()
    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (!targetPackages.contains(packageName)) {
        continue
      }
      if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
        opensByPackage[packageName] = (opensByPackage[packageName] ?: 0) + 1
      }
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

      if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
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
}
