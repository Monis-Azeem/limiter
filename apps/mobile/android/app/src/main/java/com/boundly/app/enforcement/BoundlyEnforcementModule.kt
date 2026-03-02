package com.boundly.app.enforcement

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.Locale

class BoundlyEnforcementModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val policyStore = BoundlyPolicyStore(reactContext)
  private val usageStatsCollector = UsageStatsCollector(reactContext)
  private val policyEvaluator = BoundlyPolicyEvaluator(policyStore, usageStatsCollector)

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun listInstalledApps(promise: Promise) {
    try {
      val packageManager = reactContext.packageManager
      val launchIntent = Intent(Intent.ACTION_MAIN, null).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
      }
      val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.queryIntentActivities(
          launchIntent,
          PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong())
        )
      } else {
        @Suppress("DEPRECATION")
        packageManager.queryIntentActivities(launchIntent, PackageManager.MATCH_ALL)
      }

      val userApps = resolveInfos
        .mapNotNull { resolveInfo ->
          val activityInfo = resolveInfo.activityInfo ?: return@mapNotNull null
          val packageName = activityInfo.packageName
          if (packageName == reactContext.packageName) {
            return@mapNotNull null
          }

          val flags = activityInfo.applicationInfo?.flags ?: 0
          val isSystemApp = (flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
            (flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
          if (isSystemApp) {
            return@mapNotNull null
          }

          val label = resolveInfo.loadLabel(packageManager)?.toString()?.trim()
          val displayName = if (label.isNullOrBlank()) packageName else label
          Triple(packageName, displayName, packageName)
        }
        .distinctBy { triple -> triple.first }
        .sortedBy { triple -> triple.second.lowercase(Locale.US) }

      val result = Arguments.createArray()
      userApps.forEach { (id, displayName, platformPackageId) ->
        val map = Arguments.createMap()
        map.putString("id", id)
        map.putString("displayName", displayName)
        map.putString("platformPackageId", platformPackageId)
        result.pushMap(map)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LIST_APPS_ERROR", error)
    }
  }

  @ReactMethod
  fun getPermissionStates(promise: Promise) {
    try {
      val states = Arguments.createArray()
      states.pushMap(permissionStateMap("usage_access", hasUsageAccess()))
      states.pushMap(permissionStateMap("accessibility", hasAccessibilityServiceEnabled()))
      states.pushMap(
        permissionStateMap(
          "ignore_battery_optimization",
          isIgnoringBatteryOptimizations()
        )
      )
      states.pushMap(permissionStateMap("overlay", Settings.canDrawOverlays(reactContext)))
      states.pushMap(
        permissionStateMap(
          "notifications",
          NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
        )
      )
      promise.resolve(states)
    } catch (error: Exception) {
      promise.reject("PERMISSION_STATE_ERROR", error)
    }
  }

  @ReactMethod
  fun requestPermission(permissionKey: String, promise: Promise) {
    try {
      policyStore.appendDebugLog("Permission request opened: $permissionKey")
      when (permissionKey) {
        "usage_access" -> {
          val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          reactContext.startActivity(intent)
        }
        "accessibility" -> {
          val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          reactContext.startActivity(intent)
        }
        "ignore_battery_optimization" -> {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${reactContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          reactContext.startActivity(intent)
        }
        "overlay" -> {
          val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
            data = Uri.parse("package:${reactContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          reactContext.startActivity(intent)
        }
        "notifications" -> {
          val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          reactContext.startActivity(intent)
        }
      }

      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("REQUEST_PERMISSION_ERROR", error)
    }
  }

  @ReactMethod
  fun startEnforcement(profiles: ReadableArray, promise: Promise) {
    try {
      policyStore.setProfilesJson(readableArrayToJsonArray(profiles).toString())
      policyStore.setEnforcementEnabled(true)
      policyStore.clearLastAccessibilityError()
      policyStore.appendDebugLog("Enforcement started")
      BoundlyForegroundService.start(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("START_ENFORCEMENT_ERROR", error)
    }
  }

  @ReactMethod
  fun stopEnforcement(promise: Promise) {
    try {
      policyStore.setEnforcementEnabled(false)
      policyStore.clearBlockedPackages()
      policyStore.clearLastAccessibilityError()
      policyStore.appendDebugLog("Enforcement stopped")
      BoundlyForegroundService.stop(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("STOP_ENFORCEMENT_ERROR", error)
    }
  }

  @ReactMethod
  fun syncRules(profiles: ReadableArray, promise: Promise) {
    try {
      policyStore.setProfilesJson(readableArrayToJsonArray(profiles).toString())
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SYNC_RULES_ERROR", error)
    }
  }

  @ReactMethod
  fun getHealth(promise: Promise) {
    try {
      val missingPermissions = mutableListOf<String>()
      val accessibilityEnabled = hasAccessibilityServiceEnabled()
      if (!hasUsageAccess()) {
        missingPermissions.add("usage_access")
      }
      if (!accessibilityEnabled) {
        missingPermissions.add("accessibility")
      }
      if (!isIgnoringBatteryOptimizations()) {
        missingPermissions.add("ignore_battery_optimization")
      }
      val lastAccessibilityError = policyStore.getLastAccessibilityError()

      val health = Arguments.createMap()
      health.putString(
        "status",
        when {
          missingPermissions.isNotEmpty() -> "permissions_missing"
          accessibilityEnabled && !lastAccessibilityError.isNullOrBlank() -> "enforcement_degraded"
          policyStore.isEnforcementEnabled() -> "enforcement_running"
          else -> "enforcement_stopped"
        }
      )

      val missingArray = Arguments.createArray()
      missingPermissions.forEach { missingPermission -> missingArray.pushString(missingPermission) }
      health.putArray("missingPermissions", missingArray)
      if (!lastAccessibilityError.isNullOrBlank()) {
        health.putString("detail", lastAccessibilityError)
      }
      health.putString("lastHeartbeatIso", policyStore.getLastHeartbeatIso() ?: Instant.now().toString())
      promise.resolve(health)
    } catch (error: Exception) {
      promise.reject("GET_HEALTH_ERROR", error)
    }
  }

  @ReactMethod
  fun getUsageSnapshot(promise: Promise) {
    try {
      val managedPackages = policyEvaluator.parseManagedPackages()
      val snapshot = usageStatsCollector.collectDailySnapshot(managedPackages)

      val usageSnapshotMap = Arguments.createMap()
      usageSnapshotMap.putMap("minutesByTarget", mapToWritableMap(snapshot.minutesByPackage))
      usageSnapshotMap.putMap("opensByTarget", mapToWritableMap(snapshot.opensByPackage))
      usageSnapshotMap.putInt("overridesUsedToday", policyStore.getOverrideCountToday())
      usageSnapshotMap.putString("lastOverrideAtIso", policyStore.getLastOverrideAtIso())

      promise.resolve(usageSnapshotMap)
    } catch (error: Exception) {
      promise.reject("USAGE_SNAPSHOT_ERROR", error)
    }
  }

  @ReactMethod
  fun streamUsageEvents(sinceIso: String?, promise: Promise) {
    try {
      val managedPackages = policyEvaluator.parseManagedPackages()
      val events = usageStatsCollector.collectUsageEventsSince(sinceIso, managedPackages)
      val eventArray = Arguments.createArray()
      events.forEach { event ->
        val eventMap = Arguments.createMap()
        eventMap.putString("id", event.id)
        eventMap.putString("targetAppId", event.targetPackage)
        eventMap.putString("occurredAtIso", event.occurredAtIso)
        eventMap.putString("eventType", event.eventType)
        eventMap.putInt("minutesDelta", event.minutesDelta)
        eventMap.putInt("opensDelta", event.opensDelta)
        eventArray.pushMap(eventMap)
      }
      promise.resolve(eventArray)
    } catch (error: Exception) {
      promise.reject("USAGE_EVENTS_ERROR", error)
    }
  }

  @ReactMethod
  fun getDebugLogs(promise: Promise) {
    try {
      val logs = policyStore.getDebugLogs(40)
      val logArray = Arguments.createArray()
      logs.forEach { entry -> logArray.pushString(entry) }
      promise.resolve(logArray)
    } catch (error: Exception) {
      promise.reject("GET_DEBUG_LOGS_ERROR", error)
    }
  }

  @ReactMethod
  fun clearDebugLogs(promise: Promise) {
    try {
      policyStore.clearDebugLogs()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("CLEAR_DEBUG_LOGS_ERROR", error)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      reactContext.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun hasAccessibilityServiceEnabled(): Boolean {
    val packageName = reactContext.packageName
    val serviceClassName = BoundlyAccessibilityService::class.java.name
    val shortServiceClassName = if (serviceClassName.startsWith(packageName)) {
      serviceClassName.removePrefix(packageName)
    } else {
      ".${serviceClassName.substringAfterLast('.')}"
    }
    val acceptedServiceNames = setOf(
      "$packageName/$serviceClassName",
      "$packageName/$shortServiceClassName"
    )
    val enabledServices = Settings.Secure.getString(
      reactContext.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    )

    return !enabledServices.isNullOrEmpty() &&
      TextUtils.SimpleStringSplitter(':').run {
        setString(enabledServices)
        any { item ->
          acceptedServiceNames.any { serviceName -> item.equals(serviceName, ignoreCase = true) }
        }
      }
  }

  private fun isIgnoringBatteryOptimizations(): Boolean {
    val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      powerManager.isIgnoringBatteryOptimizations(reactContext.packageName)
    } else {
      true
    }
  }

  private fun permissionStateMap(key: String, granted: Boolean): WritableMap {
    return Arguments.createMap().apply {
      putString("key", key)
      putBoolean("granted", granted)
      putString("checkedAtIso", Instant.now().toString())
    }
  }

  private fun mapToWritableMap(value: Map<String, Int>): WritableMap {
    val map = Arguments.createMap()
    value.forEach { (key, mapValue) -> map.putInt(key, mapValue) }
    return map
  }

  private fun readableArrayToJsonArray(readableArray: ReadableArray): JSONArray {
    val jsonArray = JSONArray()
    for (index in 0 until readableArray.size()) {
      when (readableArray.getType(index)) {
        ReadableType.Null -> jsonArray.put(JSONObject.NULL)
        ReadableType.Boolean -> jsonArray.put(readableArray.getBoolean(index))
        ReadableType.Number -> jsonArray.put(readableArray.getDouble(index))
        ReadableType.String -> jsonArray.put(readableArray.getString(index))
        ReadableType.Map -> jsonArray.put(readableMapToJsonObject(readableArray.getMap(index)))
        ReadableType.Array -> jsonArray.put(readableArrayToJsonArray(readableArray.getArray(index)))
      }
    }

    return jsonArray
  }

  private fun readableMapToJsonObject(readableMap: ReadableMap?): JSONObject {
    val jsonObject = JSONObject()
    if (readableMap == null) {
      return jsonObject
    }

    val iterator = readableMap.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      when (readableMap.getType(key)) {
        ReadableType.Null -> jsonObject.put(key, JSONObject.NULL)
        ReadableType.Boolean -> jsonObject.put(key, readableMap.getBoolean(key))
        ReadableType.Number -> jsonObject.put(key, readableMap.getDouble(key))
        ReadableType.String -> jsonObject.put(key, readableMap.getString(key))
        ReadableType.Map -> jsonObject.put(key, readableMapToJsonObject(readableMap.getMap(key)))
        ReadableType.Array -> {
          val nestedArray = readableMap.getArray(key)
          if (nestedArray == null) {
            jsonObject.put(key, JSONObject.NULL)
          } else {
            jsonObject.put(key, readableArrayToJsonArray(nestedArray))
          }
        }
      }
    }

    return jsonObject
  }

  companion object {
    private const val MODULE_NAME = "BoundlyEnforcement"
  }
}
