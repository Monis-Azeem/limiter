import {
  applyOverride,
  createEmptyUsageSnapshot,
  evaluatePolicy,
  type EnforcementDecision,
  type EnforcementHealth,
  type PermissionKey,
  type PermissionState,
  type RetentionPolicy,
  type RuleProfile,
  type UsageEvent,
  type UsageSnapshot
} from "@boundly/domain";
import { create } from "zustand";

import { enforcementService } from "../services/enforcement-service";
import { getProfileRepository } from "../services/profile-repository";

export type AppTab = "onboarding" | "dashboard" | "rules" | "lock" | "insights";

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  usageDays: 30,
  auditDays: 30
};

const DEFAULT_TARGET_PACKAGES = [
  "com.instagram.android",
  "com.google.android.youtube",
  "com.linkedin.android",
  "com.whatsapp"
];

const LEGACY_TARGET_ID_MAP: Record<string, string> = {
  instagram: "com.instagram.android",
  youtube: "com.google.android.youtube",
  linkedin: "com.linkedin.android",
  whatsapp: "com.whatsapp"
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTargetId(targetId: string): string {
  const token = targetId.trim();
  return LEGACY_TARGET_ID_MAP[token] ?? token;
}

function toSimpleProfile(base?: RuleProfile): RuleProfile {
  const normalizedTargetId = normalizeTargetId(
    base?.targetAppIds[0] ?? DEFAULT_TARGET_PACKAGES[0] ?? "com.instagram.android"
  );
  const targetId =
    normalizedTargetId.length > 0
      ? normalizedTargetId
      : (DEFAULT_TARGET_PACKAGES[0] ?? "com.instagram.android");
  const dailyLimitMinutes = Math.max(1, base?.dailyLimitMinutes ?? 30);
  const isAlreadySimple =
    !!base &&
    base.id === "daily-limit" &&
    base.enabled &&
    base.targetAppIds.length === 1 &&
    base.targetAppIds[0] === targetId &&
    base.windows.length === 0 &&
    base.dailyLimitMinutes === dailyLimitMinutes &&
    base.dailyOpenLimit === 9999 &&
    base.frictionPolicy.intentRequired === false &&
    base.frictionPolicy.delaySeconds === 0;

  if (isAlreadySimple) {
    return base;
  }

  const updatedAtIso = nowIso();
  return {
    id: "daily-limit",
    name: "Daily limit",
    revision: (base?.revision ?? 0) + 1,
    updatedAtIso,
    enabled: true,
    targetAppIds: [targetId],
    windows: [],
    dailyLimitMinutes,
    dailyOpenLimit: 9999,
    overridePolicy: {
      maxOverridesPerDay: 1,
      penaltyMinutes: 15,
      cooldownMinutes: 20
    },
    frictionPolicy: {
      intentRequired: false,
      delaySeconds: 0
    }
  };
}

function normalizeProfiles(profiles: RuleProfile[]): RuleProfile[] {
  return [toSimpleProfile(profiles[0])];
}

function createDefaultProfiles(): RuleProfile[] {
  return [toSimpleProfile()];
}

function getProfileById(profiles: RuleProfile[], profileId: string): RuleProfile {
  return profiles.find((profile) => profile.id === profileId) ?? profiles[0]!;
}

function calculateDecision(
  profile: RuleProfile,
  usage: UsageSnapshot,
  selectedTargetId: string,
  intentConfirmed: boolean,
  delaySatisfied: boolean,
  health?: EnforcementHealth
): EnforcementDecision {
  const input = {
    nowIso: nowIso(),
    targetAppId: selectedTargetId,
    profile,
    usage,
    attempt: {
      intentConfirmed,
      delaySatisfied
    }
  } as const;

  return evaluatePolicy(
    health
      ? {
          ...input,
          context: { health }
        }
      : input
  );
}

interface AppState {
  activeTab: AppTab;
  profiles: RuleProfile[];
  activeProfileId: string;
  selectedTargetId: string;
  usage: UsageSnapshot;
  permissionsGranted: boolean;
  permissionStates: PermissionState[];
  health: EnforcementHealth;
  retentionPolicy: RetentionPolicy;
  intentConfirmed: boolean;
  delaySatisfied: boolean;
  decision: EnforcementDecision;
  isBootstrapped: boolean;
  lastUsageEventCursorIso?: string;
  setActiveTab: (tab: AppTab) => void;
  setActiveProfile: (profileId: string) => void;
  setSelectedTargetId: (targetId: string) => void;
  setDailyLimitMinutes: (minutes: number) => void;
  setDailyOpenLimit: (opens: number) => void;
  confirmIntent: () => void;
  satisfyDelay: () => void;
  resetAttemptState: () => void;
  recordOpenAttempt: () => Promise<void>;
  addUsageMinutes: (minutes: number) => Promise<void>;
  useEmergencyOverride: () => Promise<void>;
  bootstrap: () => Promise<void>;
  requestPermission: (permissionKey: PermissionKey) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  syncFromNativeUsage: () => Promise<void>;
  startEnforcement: () => Promise<void>;
  stopEnforcement: () => Promise<void>;
  recomputeDecision: () => void;
}

const defaultProfiles = createDefaultProfiles();
const initialUsage = createEmptyUsageSnapshot();
const initialHealth: EnforcementHealth = {
  status: "enforcement_stopped",
  missingPermissions: []
};
const initialDecision = calculateDecision(
  defaultProfiles[0]!,
  initialUsage,
  "com.instagram.android",
  false,
  false,
  initialHealth
);

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: "onboarding",
  profiles: defaultProfiles,
  activeProfileId: defaultProfiles[0]!.id,
  selectedTargetId: "com.instagram.android",
  usage: initialUsage,
  permissionsGranted: false,
  permissionStates: [],
  health: initialHealth,
  retentionPolicy: DEFAULT_RETENTION_POLICY,
  intentConfirmed: false,
  delaySatisfied: false,
  decision: initialDecision,
  isBootstrapped: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setActiveProfile: (profileId) => {
    set({
      activeProfileId: profileId,
      intentConfirmed: false,
      delaySatisfied: false
    });
    get().recomputeDecision();
  },

  setSelectedTargetId: (targetId) => {
    set((state) => ({
      selectedTargetId: targetId,
      intentConfirmed: false,
      delaySatisfied: false,
      profiles: state.profiles.map((profile) =>
        profile.id === state.activeProfileId
          ? {
              ...profile,
              targetAppIds: [targetId],
              revision: profile.revision + 1,
              updatedAtIso: nowIso()
            }
          : profile
      )
    }));

    const state = get();
    const repository = getProfileRepository();
    void repository
      .replaceProfiles(state.profiles)
      .then(() => enforcementService.syncRules(state.profiles));

    get().recomputeDecision();
  },

  setDailyLimitMinutes: (minutes) => {
    const nextLimit = Math.max(1, minutes);
    set((state) => ({
      profiles: state.profiles.map((profile) =>
        profile.id === state.activeProfileId
          ? {
              ...profile,
              dailyLimitMinutes: nextLimit,
              revision: profile.revision + 1,
              updatedAtIso: nowIso()
            }
          : profile
      )
    }));

    const state = get();
    const repository = getProfileRepository();
    void repository
      .replaceProfiles(state.profiles)
      .then(() => enforcementService.syncRules(state.profiles));

    get().recomputeDecision();
  },

  setDailyOpenLimit: (opens) => {
    const nextLimit = Math.max(1, opens);
    set((state) => ({
      profiles: state.profiles.map((profile) =>
        profile.id === state.activeProfileId
          ? {
              ...profile,
              dailyOpenLimit: nextLimit,
              revision: profile.revision + 1,
              updatedAtIso: nowIso()
            }
          : profile
      )
    }));

    const state = get();
    const repository = getProfileRepository();
    void repository
      .replaceProfiles(state.profiles)
      .then(() => enforcementService.syncRules(state.profiles));

    get().recomputeDecision();
  },

  confirmIntent: () => {
    set({ intentConfirmed: true });
    get().recomputeDecision();
  },

  satisfyDelay: () => {
    set({ delaySatisfied: true });
    get().recomputeDecision();
  },

  resetAttemptState: () => {
    set({ intentConfirmed: false, delaySatisfied: false });
    get().recomputeDecision();
  },

  recordOpenAttempt: async () => {
    const state = get();
    const event: UsageEvent = {
      id: createId("open"),
      targetAppId: state.selectedTargetId,
      occurredAtIso: nowIso(),
      eventType: "open",
      opensDelta: 1
    };

    const nextUsage: UsageSnapshot = {
      ...state.usage,
      opensByTarget: {
        ...state.usage.opensByTarget,
        [state.selectedTargetId]: (state.usage.opensByTarget[state.selectedTargetId] ?? 0) + 1
      }
    };

    set({ usage: nextUsage, intentConfirmed: false, delaySatisfied: false });

    const repository = getProfileRepository();
    await repository.saveUsageEvents([event]);
    await repository.saveUsageSnapshot(nextUsage);
    get().recomputeDecision();
  },

  addUsageMinutes: async (minutes) => {
    const state = get();
    const increment = Math.max(1, minutes);
    const event: UsageEvent = {
      id: createId("usage"),
      targetAppId: state.selectedTargetId,
      occurredAtIso: nowIso(),
      eventType: "usage_update",
      minutesDelta: increment
    };

    const nextUsage: UsageSnapshot = {
      ...state.usage,
      minutesByTarget: {
        ...state.usage.minutesByTarget,
        [state.selectedTargetId]:
          (state.usage.minutesByTarget[state.selectedTargetId] ?? 0) + increment
      }
    };

    set({ usage: nextUsage });

    const repository = getProfileRepository();
    await repository.saveUsageEvents([event]);
    await repository.saveUsageSnapshot(nextUsage);
    get().recomputeDecision();
  },

  useEmergencyOverride: async () => {
    const state = get();
    const activeProfile = getProfileById(state.profiles, state.activeProfileId);
    if (state.usage.overridesUsedToday >= activeProfile.overridePolicy.maxOverridesPerDay) {
      return;
    }

    const result = applyOverride(
      activeProfile,
      state.usage,
      state.selectedTargetId,
      nowIso()
    );

    set({
      usage: result.updatedUsage,
      intentConfirmed: false,
      delaySatisfied: false
    });

    const repository = getProfileRepository();
    await repository.saveUsageSnapshot(result.updatedUsage);
    await repository.saveAuditEvent({
      id: createId("audit-override"),
      type: "emergency_override",
      severity: "warning",
      message: `Emergency override used for ${state.selectedTargetId}`,
      occurredAtIso: nowIso(),
      metadata: {
        penaltyMinutes: String(activeProfile.overridePolicy.penaltyMinutes),
        cooldownUntilIso: result.cooldownUntilIso
      }
    });

    get().recomputeDecision();
  },

  bootstrap: async () => {
    const repository = getProfileRepository();

    let profiles = await repository.getProfiles();
    if (profiles.length === 0) {
      profiles = createDefaultProfiles();
      await repository.replaceProfiles(profiles);
    }

    const normalizedProfiles = normalizeProfiles(profiles);
    if (JSON.stringify(normalizedProfiles) !== JSON.stringify(profiles)) {
      profiles = normalizedProfiles;
      await repository.replaceProfiles(profiles);
    }

    const retentionPolicy = await repository.getRetentionPolicy();

    const usage = await repository.getUsageSnapshot();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionPolicy.usageDays);
    await repository.pruneOlderThan(cutoffDate.toISOString());
    const retentionPolicyAfterPrune: RetentionPolicy = {
      ...retentionPolicy,
      lastPrunedAtIso: nowIso()
    };
    await repository.setRetentionPolicy(retentionPolicyAfterPrune);

    await enforcementService.syncRules(profiles);

    const permissionStates = await enforcementService.getPermissionStates();
    const permissionsGranted = permissionStates
      .filter((permissionState) =>
        ["usage_access", "accessibility", "ignore_battery_optimization"].includes(
          permissionState.key
        )
      )
      .every((permissionState) => permissionState.granted);

    const health = await enforcementService.getHealth();

    const activeProfileId = profiles[0]?.id ?? "daily-limit";
    const selectedTargetId =
      profiles[0]?.targetAppIds[0] ?? DEFAULT_TARGET_PACKAGES[0] ?? "com.instagram.android";

    set({
      profiles,
      activeProfileId,
      selectedTargetId,
      usage,
      permissionStates,
      permissionsGranted,
      health,
      retentionPolicy: retentionPolicyAfterPrune,
      isBootstrapped: true
    });

    get().recomputeDecision();
    await get().syncFromNativeUsage();
  },

  requestPermission: async (permissionKey) => {
    await enforcementService.requestPermission(permissionKey);
    await get().refreshPermissions();
  },

  refreshPermissions: async () => {
    const permissionStates = await enforcementService.getPermissionStates();
    const health = await enforcementService.getHealth();
    const permissionsGranted = permissionStates
      .filter((permissionState) =>
        ["usage_access", "accessibility", "ignore_battery_optimization"].includes(
          permissionState.key
        )
      )
      .every((permissionState) => permissionState.granted);

    set({ permissionStates, health, permissionsGranted });
    get().recomputeDecision();
  },

  syncFromNativeUsage: async () => {
    const state = get();
    const repository = getProfileRepository();

    const lastPrunedAt = state.retentionPolicy.lastPrunedAtIso
      ? new Date(state.retentionPolicy.lastPrunedAtIso).getTime()
      : 0;
    if (Date.now() - lastPrunedAt > 24 * 60 * 60 * 1000) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - state.retentionPolicy.usageDays);
      await repository.pruneOlderThan(cutoffDate.toISOString());
      const nextRetentionPolicy: RetentionPolicy = {
        ...state.retentionPolicy,
        lastPrunedAtIso: nowIso()
      };
      await repository.setRetentionPolicy(nextRetentionPolicy);
      set({ retentionPolicy: nextRetentionPolicy });
    }

    const events = await enforcementService.streamUsageEvents(state.lastUsageEventCursorIso);
    if (events.length > 0) {
      await repository.saveUsageEvents(events);
      const usage = await repository.getUsageSnapshot();
      const lastUsageEventCursorIso = events[events.length - 1]?.occurredAtIso;
      if (lastUsageEventCursorIso) {
        set({ usage, lastUsageEventCursorIso });
      } else {
        set({ usage });
      }
      get().recomputeDecision();
    }

    const nativeSnapshot = await enforcementService.getUsageSnapshot();
    if (Object.keys(nativeSnapshot.minutesByTarget).length > 0) {
      await repository.saveUsageSnapshot(nativeSnapshot);
      set({ usage: nativeSnapshot });
      get().recomputeDecision();
    }
  },

  startEnforcement: async () => {
    const state = get();
    await enforcementService.startEnforcement(state.profiles);
    const health = await enforcementService.getHealth();
    set({ health });
    get().recomputeDecision();
  },

  stopEnforcement: async () => {
    await enforcementService.stopEnforcement();
    const health = await enforcementService.getHealth();
    set({ health });
    get().recomputeDecision();
  },

  recomputeDecision: () => {
    const state = get();
    const activeProfile = getProfileById(state.profiles, state.activeProfileId);
    const decision = calculateDecision(
      activeProfile,
      state.usage,
      state.selectedTargetId,
      state.intentConfirmed,
      state.delaySatisfied,
      state.health
    );

    set({ decision });
  }
}));
