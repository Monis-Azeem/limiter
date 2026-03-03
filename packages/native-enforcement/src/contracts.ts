import type {
  AppTarget,
  EnforcementHealth,
  LiveAppUsageRow,
  PermissionKey,
  PermissionState,
  RuleProfile,
  UsageEvent,
  UsageSnapshot
} from "@boundly/domain";

export interface NativeEnforcementAdapter {
  listInstalledApps(): Promise<AppTarget[]>;
  getPermissionStates(): Promise<PermissionState[]>;
  requestPermission(permissionKey: PermissionKey): Promise<boolean>;
  startEnforcement(profiles: RuleProfile[]): Promise<void>;
  stopEnforcement(): Promise<void>;
  syncRules(profiles: RuleProfile[]): Promise<void>;
  getHealth(): Promise<EnforcementHealth>;
  getUsageSnapshot(): Promise<UsageSnapshot>;
  getLiveAppUsage(): Promise<LiveAppUsageRow[]>;
  streamUsageEvents(sinceIso?: string): Promise<UsageEvent[]>;
  getDebugLogs(): Promise<string[]>;
  clearDebugLogs(): Promise<void>;
}
