package com.boundly.app.enforcement

import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.LocalDateTime

class BoundlyPolicyEvaluator(
  private val policyStore: BoundlyPolicyStore,
  private val usageStatsCollector: UsageStatsCollector,
  private val appPackageName: String
) {
  data class BlockedTarget(
    val packageName: String,
    val reason: String
  )

  fun evaluateBlockedTargetsNow(): List<BlockedTarget> {
    val profiles = parseProfiles(policyStore.getProfilesJson())
    if (profiles.isEmpty()) {
      return emptyList()
    }

    val targetPackages = profiles
      .filter { it.enabled }
      .flatMap { it.targetPackages }
      .toSet()

    val snapshot = usageStatsCollector.collectDailySnapshot(targetPackages)
    val now = LocalDateTime.now()
    val blockedTargets = mutableMapOf<String, BlockedTarget>()

    profiles.filter { it.enabled }.forEach { profile ->
      val inWindow = profile.windows.any { window -> window.isActive(now) }
      profile.targetPackages.forEach { targetPackage ->
        val minutesUsed = snapshot.minutesByPackage[targetPackage] ?: 0
        val limitReached = minutesUsed >= profile.dailyLimitMinutes
        if (!inWindow && !limitReached) {
          return@forEach
        }
        val reason = when {
          limitReached -> "Daily limit reached (${minutesUsed}m/${profile.dailyLimitMinutes}m)"
          inWindow -> "Blocked by schedule"
          else -> "Blocked"
        }
        blockedTargets[targetPackage] = BlockedTarget(
          packageName = targetPackage,
          reason = reason
        )
      }
    }

    return blockedTargets.values.toList()
  }

  fun evaluateBlockedReasonMapNow(): Map<String, String> = evaluateBlockedTargetsNow()
    .associate { blockedTarget -> blockedTarget.packageName to blockedTarget.reason }

  fun evaluateBlockedPackagesNow(): Set<String> {
    return evaluateBlockedTargetsNow()
      .map { blockedTarget -> blockedTarget.packageName }
      .toSet()
  }

  fun parseManagedPackages(): Set<String> = parseProfiles(policyStore.getProfilesJson())
    .flatMap { it.targetPackages }
    .toSet()

  private fun parseProfiles(rawProfilesJson: String): List<PolicyProfile> {
    val profiles = mutableListOf<PolicyProfile>()
    val profileJsonArray = runCatching { JSONArray(rawProfilesJson) }.getOrElse { JSONArray("[]") }

    for (index in 0 until profileJsonArray.length()) {
      val profileJson = profileJsonArray.optJSONObject(index) ?: continue
      val enabled = profileJson.optBoolean("enabled", true)
      val dailyLimitMinutes = profileJson.optInt("dailyLimitMinutes", Int.MAX_VALUE)

      val targetPackages = mutableSetOf<String>()
      val targetJsonArray = profileJson.optJSONArray("targetAppIds") ?: JSONArray("[]")
      for (targetIndex in 0 until targetJsonArray.length()) {
        val target = targetJsonArray.optString(targetIndex, "")
        if (target.isNotBlank() && target != appPackageName) {
          targetPackages.add(target)
        }
      }

      val windows = mutableListOf<PolicyWindow>()
      val windowsJsonArray = profileJson.optJSONArray("windows") ?: JSONArray("[]")
      for (windowIndex in 0 until windowsJsonArray.length()) {
        val windowJson = windowsJsonArray.optJSONObject(windowIndex) ?: continue
        val daysJsonArray = windowJson.optJSONArray("days") ?: JSONArray("[]")
        val days = mutableSetOf<String>()
        for (dayIndex in 0 until daysJsonArray.length()) {
          val day = daysJsonArray.optString(dayIndex, "")
          if (day.isNotBlank()) {
            days.add(day)
          }
        }
        windows.add(
          PolicyWindow(
            days = days,
            startMinute = windowJson.optInt("startMinute", 0),
            endMinute = windowJson.optInt("endMinute", 0)
          )
        )
      }

      profiles.add(
        PolicyProfile(
          id = profileJson.optString("id", "profile-$index"),
          enabled = enabled,
          targetPackages = targetPackages,
          windows = windows,
          dailyLimitMinutes = dailyLimitMinutes
        )
      )
    }

    return profiles
  }

  private data class PolicyProfile(
    val id: String,
    val enabled: Boolean,
    val targetPackages: Set<String>,
    val windows: List<PolicyWindow>,
    val dailyLimitMinutes: Int
  )

  private data class PolicyWindow(
    val days: Set<String>,
    val startMinute: Int,
    val endMinute: Int
  ) {
    fun isActive(now: LocalDateTime): Boolean {
      if (days.isEmpty()) {
        return false
      }

      val dayToken = dayOfWeekToken(now.dayOfWeek)
      val minuteOfDay = now.hour * 60 + now.minute

      if (startMinute == endMinute) {
        return days.contains(dayToken)
      }

      if (startMinute < endMinute) {
        return days.contains(dayToken) && minuteOfDay in startMinute until endMinute
      }

      val previousDayToken = previousDayToken(dayToken)
      val inCurrentDayTail = days.contains(dayToken) && minuteOfDay >= startMinute
      val inPreviousDayCarry = days.contains(previousDayToken) && minuteOfDay < endMinute

      return inCurrentDayTail || inPreviousDayCarry
    }

    private fun dayOfWeekToken(dayOfWeek: DayOfWeek): String {
      return when (dayOfWeek) {
        DayOfWeek.SUNDAY -> "sun"
        DayOfWeek.MONDAY -> "mon"
        DayOfWeek.TUESDAY -> "tue"
        DayOfWeek.WEDNESDAY -> "wed"
        DayOfWeek.THURSDAY -> "thu"
        DayOfWeek.FRIDAY -> "fri"
        DayOfWeek.SATURDAY -> "sat"
      }
    }

    private fun previousDayToken(dayToken: String): String {
      return when (dayToken) {
        "sun" -> "sat"
        "mon" -> "sun"
        "tue" -> "mon"
        "wed" -> "tue"
        "thu" -> "wed"
        "fri" -> "thu"
        else -> "fri"
      }
    }
  }
}
