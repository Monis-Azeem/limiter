package com.boundly.app.enforcement

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

class BoundlyPolicyStore(private val context: Context) {
  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun isEnforcementEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

  fun setEnforcementEnabled(enabled: Boolean) {
    prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  fun setProfilesJson(profilesJson: String) {
    prefs.edit().putString(KEY_PROFILES_JSON, profilesJson).apply()
  }

  fun getProfilesJson(): String = prefs.getString(KEY_PROFILES_JSON, "[]") ?: "[]"

  fun getManagedPackages(): Set<String> {
    val managed = mutableSetOf<String>()
    val root = runCatching { JSONArray(getProfilesJson()) }.getOrElse { JSONArray("[]") }
    for (index in 0 until root.length()) {
      val profile = root.optJSONObject(index) ?: continue
      if (!profile.optBoolean("enabled", true)) {
        continue
      }
      val targetIds = profile.optJSONArray("targetAppIds") ?: JSONArray("[]")
      for (targetIndex in 0 until targetIds.length()) {
        val target = targetIds.optString(targetIndex, "")
        if (target.isNotBlank()) {
          managed.add(target)
        }
      }
    }
    return managed
  }

  fun setBlockedPackages(
    blockedPackages: Set<String>,
    blockedReasons: Map<String, String> = emptyMap()
  ) {
    val jsonArray = JSONArray()
    blockedPackages.forEach { blockedPackage -> jsonArray.put(blockedPackage) }
    val reasonJson = JSONObject()
    blockedPackages.forEach { blockedPackage ->
      val reason = blockedReasons[blockedPackage] ?: "Daily limit reached"
      reasonJson.put(blockedPackage, reason)
    }
    prefs.edit()
      .putString(KEY_BLOCKED_PACKAGES, jsonArray.toString())
      .putString(KEY_BLOCKED_PACKAGE_REASONS, reasonJson.toString())
      .apply()
  }

  fun getBlockedPackages(): Set<String> {
    val raw = prefs.getString(KEY_BLOCKED_PACKAGES, "[]") ?: "[]"
    val blockedPackages = mutableSetOf<String>()
    runCatching { JSONArray(raw) }
      .onFailure {
        prefs.edit().putString(KEY_BLOCKED_PACKAGES, "[]").apply()
      }
      .getOrElse { JSONArray("[]") }
      .let { jsonArray ->
        for (index in 0 until jsonArray.length()) {
          blockedPackages.add(jsonArray.optString(index, ""))
        }
      }
    blockedPackages.removeAll { it.isBlank() }
    return blockedPackages
  }

  fun clearBlockedPackages() {
    prefs.edit()
      .putString(KEY_BLOCKED_PACKAGES, "[]")
      .putString(KEY_BLOCKED_PACKAGE_REASONS, "{}")
      .apply()
  }

  fun getBlockedReason(packageName: String): String? {
    val raw = prefs.getString(KEY_BLOCKED_PACKAGE_REASONS, "{}") ?: "{}"
    return runCatching { JSONObject(raw).optString(packageName, "") }
      .getOrElse { "" }
      .ifBlank { null }
  }

  fun setLastHeartbeatIso(lastHeartbeatIso: String) {
    prefs.edit().putString(KEY_LAST_HEARTBEAT_ISO, lastHeartbeatIso).apply()
  }

  fun getLastHeartbeatIso(): String? = prefs.getString(KEY_LAST_HEARTBEAT_ISO, null)

  fun setLastSelfHealAttemptIso(lastSelfHealAttemptIso: String) {
    prefs.edit().putString(KEY_LAST_SELF_HEAL_ATTEMPT_ISO, lastSelfHealAttemptIso).apply()
  }

  fun getLastSelfHealAttemptIso(): String? = prefs.getString(KEY_LAST_SELF_HEAL_ATTEMPT_ISO, null)

  fun setOverrideCountToday(count: Int) {
    prefs.edit().putInt(KEY_OVERRIDE_COUNT_TODAY, count).apply()
  }

  fun getOverrideCountToday(): Int = prefs.getInt(KEY_OVERRIDE_COUNT_TODAY, 0)

  fun setLastOverrideAtIso(lastOverrideAtIso: String?) {
    prefs.edit().putString(KEY_LAST_OVERRIDE_AT_ISO, lastOverrideAtIso).apply()
  }

  fun getLastOverrideAtIso(): String? = prefs.getString(KEY_LAST_OVERRIDE_AT_ISO, null)

  fun setLastAccessibilityError(errorMessage: String?) {
    prefs.edit().putString(KEY_LAST_ACCESSIBILITY_ERROR, errorMessage).apply()
    if (!errorMessage.isNullOrBlank()) {
      appendDebugLog("Accessibility error: $errorMessage")
    }
  }

  fun getLastAccessibilityError(): String? = prefs.getString(KEY_LAST_ACCESSIBILITY_ERROR, null)

  fun clearLastAccessibilityError() {
    prefs.edit().remove(KEY_LAST_ACCESSIBILITY_ERROR).apply()
  }

  fun appendDebugLog(message: String) {
    val current = getDebugLogs(MAX_DEBUG_LOG_ENTRIES)
    val next = current.toMutableList()
    next.add("${Instant.now()} | $message")
    val trimmed = if (next.size > MAX_DEBUG_LOG_ENTRIES) {
      next.takeLast(MAX_DEBUG_LOG_ENTRIES)
    } else {
      next
    }
    saveDebugLogs(trimmed)
  }

  fun getDebugLogs(limit: Int = 30): List<String> {
    val raw = prefs.getString(KEY_DEBUG_LOGS, "[]") ?: "[]"
    val entries = mutableListOf<String>()
    runCatching { JSONArray(raw) }
      .getOrElse { JSONArray("[]") }
      .let { jsonArray ->
        for (index in 0 until jsonArray.length()) {
          val entry = jsonArray.optString(index, "")
          if (entry.isNotBlank()) {
            entries.add(entry)
          }
        }
      }

    if (limit <= 0) {
      return emptyList()
    }
    return entries.takeLast(limit).reversed()
  }

  fun clearDebugLogs() {
    prefs.edit().putString(KEY_DEBUG_LOGS, "[]").apply()
  }

  fun getAndAdvanceQuoteIndex(totalQuotes: Int): Int {
    if (totalQuotes <= 0) {
      return 0
    }

    val currentIndex = prefs.getInt(KEY_QUOTE_INDEX, 0).coerceAtLeast(0)
    val normalizedIndex = currentIndex % totalQuotes
    val nextIndex = (normalizedIndex + 1) % totalQuotes
    prefs.edit().putInt(KEY_QUOTE_INDEX, nextIndex).apply()
    return normalizedIndex
  }

  fun getOrCreateSetupBaselineMinutes(
    dayIso: String,
    targetPackage: String,
    observedMinutes: Int
  ): Int {
    val firstDayByPackage = loadJsonObject(KEY_SETUP_BASELINE_FIRST_DAY)
    val firstManagedDay = firstDayByPackage.optString(targetPackage, "")
    if (firstManagedDay.isNotBlank() && firstManagedDay != dayIso) {
      return 0
    }

    val root = loadJsonObject(KEY_SETUP_BASELINES)
    val dayObject = root.optJSONObject(dayIso) ?: JSONObject().also { root.put(dayIso, it) }
    if (!dayObject.has(targetPackage)) {
      dayObject.put(targetPackage, observedMinutes.coerceAtLeast(0))
      saveJsonObject(KEY_SETUP_BASELINES, root)
      if (firstManagedDay.isBlank()) {
        firstDayByPackage.put(targetPackage, dayIso)
        saveJsonObject(KEY_SETUP_BASELINE_FIRST_DAY, firstDayByPackage)
      }
      appendDebugLog("Baseline captured for $targetPackage on $dayIso = ${observedMinutes.coerceAtLeast(0)}m")
    }
    clearJsonDaysExcept(KEY_SETUP_BASELINES, dayIso)
    return dayObject.optInt(targetPackage, 0).coerceAtLeast(0)
  }

  fun clearSetupBaselinesForDay(dayIso: String) {
    clearJsonDaysExcept(KEY_SETUP_BASELINES, dayIso)
  }

  fun addFallbackUsageSeconds(dayIso: String, targetPackage: String, seconds: Long) {
    val boundedSeconds = seconds.coerceAtLeast(0L)
    if (boundedSeconds <= 0L) {
      return
    }
    val root = loadJsonObject(KEY_FALLBACK_USAGE_SECONDS)
    val dayObject = root.optJSONObject(dayIso) ?: JSONObject().also { root.put(dayIso, it) }
    val current = dayObject.optLong(targetPackage, 0L)
    dayObject.put(targetPackage, current + boundedSeconds)
    saveJsonObject(KEY_FALLBACK_USAGE_SECONDS, root)
    clearJsonDaysExcept(KEY_FALLBACK_USAGE_SECONDS, dayIso)
  }

  fun getFallbackMinutesForDay(dayIso: String, targetPackage: String): Int {
    val root = loadJsonObject(KEY_FALLBACK_USAGE_SECONDS)
    clearJsonDaysExcept(KEY_FALLBACK_USAGE_SECONDS, dayIso)
    val seconds = root.optJSONObject(dayIso)?.optLong(targetPackage, 0L) ?: 0L
    return (seconds / 60L).toInt().coerceAtLeast(0)
  }

  fun clearFallbackUsageForDay(dayIso: String) {
    clearJsonDaysExcept(KEY_FALLBACK_USAGE_SECONDS, dayIso)
  }

  private fun loadJsonObject(key: String): JSONObject {
    val raw = prefs.getString(key, "{}") ?: "{}"
    return runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
  }

  private fun saveJsonObject(key: String, value: JSONObject) {
    prefs.edit().putString(key, value.toString()).apply()
  }

  private fun clearJsonDaysExcept(key: String, keepDayIso: String) {
    val root = loadJsonObject(key)
    val keysToDelete = mutableListOf<String>()
    val iterator = root.keys()
    while (iterator.hasNext()) {
      val keyName = iterator.next()
      if (keyName != keepDayIso) {
        keysToDelete.add(keyName)
      }
    }
    if (keysToDelete.isNotEmpty()) {
      keysToDelete.forEach { dayKey -> root.remove(dayKey) }
      saveJsonObject(key, root)
    }
  }

  private fun saveDebugLogs(entries: List<String>) {
    val jsonArray = JSONArray()
    entries.forEach { entry -> jsonArray.put(entry) }
    prefs.edit().putString(KEY_DEBUG_LOGS, jsonArray.toString()).apply()
  }

  companion object {
    const val PREFS_NAME = "boundly_enforcement"
    const val KEY_ENABLED = "enabled"
    const val KEY_PROFILES_JSON = "profiles_json"
    const val KEY_BLOCKED_PACKAGES = "blocked_packages"
    const val KEY_BLOCKED_PACKAGE_REASONS = "blocked_package_reasons"
    const val KEY_LAST_HEARTBEAT_ISO = "last_heartbeat_iso"
    const val KEY_LAST_SELF_HEAL_ATTEMPT_ISO = "last_self_heal_attempt_iso"
    const val KEY_OVERRIDE_COUNT_TODAY = "override_count_today"
    const val KEY_LAST_OVERRIDE_AT_ISO = "last_override_at_iso"
    const val KEY_LAST_ACCESSIBILITY_ERROR = "last_accessibility_error"
    const val KEY_DEBUG_LOGS = "debug_logs"
    const val KEY_QUOTE_INDEX = "quote_index"
    const val KEY_SETUP_BASELINES = "setup_baselines"
    const val KEY_SETUP_BASELINE_FIRST_DAY = "setup_baseline_first_day"
    const val KEY_FALLBACK_USAGE_SECONDS = "fallback_usage_seconds"
    const val MAX_DEBUG_LOG_ENTRIES = 120
  }
}
