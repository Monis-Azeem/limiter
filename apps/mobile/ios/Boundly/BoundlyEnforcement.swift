import Foundation
import React

@objc(BoundlyEnforcement)
class BoundlyEnforcement: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc
  func listInstalledApps(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve([])
  }

  @objc
  func getPermissionStates(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let states: [[String: Any]] = [
      ["key": "usage_access", "granted": false, "checkedAtIso": ISO8601DateFormatter().string(from: Date())],
      ["key": "accessibility", "granted": false, "checkedAtIso": ISO8601DateFormatter().string(from: Date())],
      ["key": "ignore_battery_optimization", "granted": true, "checkedAtIso": ISO8601DateFormatter().string(from: Date())]
    ]
    resolve(states)
  }

  @objc
  func requestPermission(_ permissionKey: NSString, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(false)
  }

  @objc
  func startEnforcement(_ profiles: NSArray, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc
  func stopEnforcement(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc
  func syncRules(_ profiles: NSArray, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc
  func getHealth(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve([
      "status": "enforcement_degraded",
      "missingPermissions": ["usage_access", "accessibility"],
      "detail": "iOS hard enforcement scaffold only in this phase"
    ])
  }

  @objc
  func getUsageSnapshot(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve([
      "minutesByTarget": [:],
      "opensByTarget": [:],
      "overridesUsedToday": 0
    ])
  }

  @objc
  func streamUsageEvents(_ sinceIso: NSString?, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve([])
  }

  @objc
  func addListener(_ eventName: NSString) {}

  @objc
  func removeListeners(_ count: NSNumber) {}
}
