import type {
  AppTarget,
  EnforcementHealth,
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
  streamUsageEvents(sinceIso?: string): Promise<UsageEvent[]>;
}
