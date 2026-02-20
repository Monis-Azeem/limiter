import {
  MockNativeEnforcementAdapter,
  type NativeEnforcementAdapter,
  ReactNativeEnforcementAdapter
} from "@boundly/native-enforcement";
import type {
  AppTarget,
  EnforcementHealth,
  PermissionKey,
  PermissionState,
  RuleProfile,
  UsageEvent,
  UsageSnapshot
} from "@boundly/domain";
import { createEmptyUsageSnapshot } from "@boundly/domain";
import { Platform } from "react-native";

class IosScaffoldEnforcementAdapter implements NativeEnforcementAdapter {
  async listInstalledApps(): Promise<AppTarget[]> {
    return [];
  }

  async getPermissionStates(): Promise<PermissionState[]> {
    const checkedAtIso = new Date().toISOString();
    return [
      { key: "usage_access", granted: false, checkedAtIso },
      { key: "accessibility", granted: false, checkedAtIso },
      { key: "ignore_battery_optimization", granted: true, checkedAtIso }
    ];
  }

  async requestPermission(_permissionKey: PermissionKey): Promise<boolean> {
    return false;
  }

  async startEnforcement(_profiles: RuleProfile[]): Promise<void> {}

  async stopEnforcement(): Promise<void> {}

  async syncRules(_profiles: RuleProfile[]): Promise<void> {}

  async getHealth(): Promise<EnforcementHealth> {
    return {
      status: "enforcement_degraded",
      missingPermissions: ["usage_access", "accessibility"],
      detail: "iOS hard enforcement is scaffolded only in this phase"
    };
  }

  async getUsageSnapshot(): Promise<UsageSnapshot> {
    return createEmptyUsageSnapshot();
  }

  async streamUsageEvents(): Promise<UsageEvent[]> {
    return [];
  }
}

function createAdapter() {
  try {
    return new ReactNativeEnforcementAdapter();
  } catch {
    if (Platform.OS === "ios") {
      return new IosScaffoldEnforcementAdapter();
    }
    return new MockNativeEnforcementAdapter();
  }
}

export const enforcementService = createAdapter();
