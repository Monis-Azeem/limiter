import type {
  AppTarget,
  EnforcementHealth,
  PermissionKey,
  PermissionState,
  RuleProfile,
  UsageEvent,
  UsageSnapshot
} from "@boundly/domain";
import { NativeEventEmitter, NativeModules, Platform } from "react-native";

import type { NativeEnforcementAdapter } from "./contracts";

interface NativeBoundlyModule {
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

const MODULE_NAME = "BoundlyEnforcement";

export class ReactNativeEnforcementAdapter implements NativeEnforcementAdapter {
  private readonly module: NativeBoundlyModule | null;
  private readonly emitter: NativeEventEmitter | null;

  constructor() {
    this.module = (NativeModules[MODULE_NAME] as NativeBoundlyModule | undefined) ?? null;
    if (!this.module) {
      throw new Error(`${MODULE_NAME} native module is unavailable`);
    }
    this.emitter =
      Platform.OS === "android" && this.module
        ? new NativeEventEmitter(NativeModules[MODULE_NAME])
        : null;
  }

  private requireModule(): NativeBoundlyModule {
    if (!this.module) {
      throw new Error(`${MODULE_NAME} native module is unavailable on this platform`);
    }

    return this.module;
  }

  listenUsageEvents(onEvent: (event: UsageEvent) => void): () => void {
    if (!this.emitter) {
      return () => {};
    }

    const subscription = this.emitter.addListener("BoundlyUsageEvent", onEvent);
    return () => subscription.remove();
  }

  listInstalledApps(): Promise<AppTarget[]> {
    return this.requireModule().listInstalledApps();
  }

  getPermissionStates(): Promise<PermissionState[]> {
    return this.requireModule().getPermissionStates();
  }

  requestPermission(permissionKey: PermissionKey): Promise<boolean> {
    return this.requireModule().requestPermission(permissionKey);
  }

  startEnforcement(profiles: RuleProfile[]): Promise<void> {
    return this.requireModule().startEnforcement(profiles);
  }

  stopEnforcement(): Promise<void> {
    return this.requireModule().stopEnforcement();
  }

  syncRules(profiles: RuleProfile[]): Promise<void> {
    return this.requireModule().syncRules(profiles);
  }

  getHealth(): Promise<EnforcementHealth> {
    return this.requireModule().getHealth();
  }

  getUsageSnapshot(): Promise<UsageSnapshot> {
    return this.requireModule().getUsageSnapshot();
  }

  streamUsageEvents(sinceIso?: string): Promise<UsageEvent[]> {
    return this.requireModule().streamUsageEvents(sinceIso);
  }
}
