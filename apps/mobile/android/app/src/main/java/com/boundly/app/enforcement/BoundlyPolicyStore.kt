package com.boundly.app.enforcement

import android.content.Context
import org.json.JSONArray
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

  fun setBlockedPackages(blockedPackages: Set<String>) {
    val jsonArray = JSONArray()
    blockedPackages.forEach { blockedPackage -> jsonArray.put(blockedPackage) }
    prefs.edit().putString(KEY_BLOCKED_PACKAGES, jsonArray.toString()).apply()
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
    prefs.edit().putString(KEY_BLOCKED_PACKAGES, "[]").apply()
  }

  fun setLastHeartbeatIso(lastHeartbeatIso: String) {
    prefs.edit().putString(KEY_LAST_HEARTBEAT_ISO, lastHeartbeatIso).apply()
  }

  fun getLastHeartbeatIso(): String? = prefs.getString(KEY_LAST_HEARTBEAT_ISO, null)

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
    const val KEY_LAST_HEARTBEAT_ISO = "last_heartbeat_iso"
    const val KEY_OVERRIDE_COUNT_TODAY = "override_count_today"
    const val KEY_LAST_OVERRIDE_AT_ISO = "last_override_at_iso"
    const val KEY_LAST_ACCESSIBILITY_ERROR = "last_accessibility_error"
    const val KEY_DEBUG_LOGS = "debug_logs"
    const val MAX_DEBUG_LOG_ENTRIES = 120
  }
}
