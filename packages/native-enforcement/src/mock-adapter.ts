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

import type { NativeEnforcementAdapter } from "./contracts";

const MOCK_APPS: AppTarget[] = [
  {
    id: "instagram",
    displayName: "Instagram",
    platformPackageId: "com.instagram.android"
  },
  {
    id: "youtube",
    displayName: "YouTube",
    platformPackageId: "com.google.android.youtube"
  },
  {
    id: "whatsapp",
    displayName: "WhatsApp",
    platformPackageId: "com.whatsapp"
  },
  {
    id: "linkedin",
    displayName: "LinkedIn",
    platformPackageId: "com.linkedin.android"
  }
];

export class MockNativeEnforcementAdapter implements NativeEnforcementAdapter {
  private profiles: RuleProfile[] = [];
  private usage: UsageSnapshot = createEmptyUsageSnapshot();
  private permissionStates: PermissionState[] = [
    {
      key: "usage_access",
      granted: true,
      checkedAtIso: new Date().toISOString()
    },
    {
      key: "accessibility",
      granted: true,
      checkedAtIso: new Date().toISOString()
    },
    {
      key: "ignore_battery_optimization",
      granted: true,
      checkedAtIso: new Date().toISOString()
    }
  ];
  private running = false;
  private events: UsageEvent[] = [];

  async listInstalledApps(): Promise<AppTarget[]> {
    return MOCK_APPS;
  }

  async getPermissionStates(): Promise<PermissionState[]> {
    return this.permissionStates;
  }

  async requestPermission(permissionKey: PermissionKey): Promise<boolean> {
    this.permissionStates = this.permissionStates.map((permissionState) =>
      permissionState.key === permissionKey
        ? {
            ...permissionState,
            granted: true,
            checkedAtIso: new Date().toISOString()
          }
        : permissionState
    );
    return true;
  }

  async startEnforcement(profiles: RuleProfile[]): Promise<void> {
    this.running = true;
    this.profiles = profiles;
  }

  async stopEnforcement(): Promise<void> {
    this.running = false;
  }

  async syncRules(profiles: RuleProfile[]): Promise<void> {
    this.profiles = profiles;
  }

  async getHealth(): Promise<EnforcementHealth> {
    const missingPermissions = this.permissionStates
      .filter((permissionState) => !permissionState.granted)
      .map((permissionState) => permissionState.key);

    if (missingPermissions.length > 0) {
      return {
        status: "permissions_missing",
        missingPermissions,
        lastHeartbeatIso: new Date().toISOString()
      };
    }

    return {
      status: this.running ? "enforcement_running" : "enforcement_stopped",
      missingPermissions: [],
      lastHeartbeatIso: new Date().toISOString()
    };
  }

  async getUsageSnapshot(): Promise<UsageSnapshot> {
    return this.usage;
  }

  async streamUsageEvents(): Promise<UsageEvent[]> {
    return this.events;
  }
}
