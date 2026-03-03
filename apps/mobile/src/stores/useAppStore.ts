import {
  applyOverride,
  createEmptyUsageSnapshot,
  evaluatePolicy,
  type EnforcementDecision,
  type EnforcementHealth,
  type LiveAppUsageRow,
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
const DEFAULT_TARGET_ID = DEFAULT_TARGET_PACKAGES[0] ?? "com.instagram.android";
const DEFAULT_DAILY_LIMIT_MINUTES = 30;

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

function profileIdForTarget(targetId: string): string {
  return `daily-limit:${targetId}`;
}

function toSimpleProfile(targetIdInput: string, base?: RuleProfile): RuleProfile {
  const normalizedTargetId = normalizeTargetId(targetIdInput);
  const targetId =
    normalizedTargetId.length > 0
      ? normalizedTargetId
      : DEFAULT_TARGET_ID;
  const dailyLimitMinutes = Math.max(1, base?.dailyLimitMinutes ?? DEFAULT_DAILY_LIMIT_MINUTES);
  const profileId = profileIdForTarget(targetId);
  const isAlreadySimple =
    !!base &&
    base.id === profileId &&
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
    id: profileId,
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

function createSimpleProfile(targetIdInput: string, dailyLimitMinutes: number): RuleProfile {
  const targetId = normalizeTargetId(targetIdInput) || DEFAULT_TARGET_ID;
  return toSimpleProfile(targetId, {
    id: profileIdForTarget(targetId),
    name: "Daily limit",
    revision: 0,
    updatedAtIso: nowIso(),
    enabled: true,
    targetAppIds: [targetId],
    windows: [],
    dailyLimitMinutes: Math.max(1, dailyLimitMinutes),
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
  });
}

function normalizeProfiles(profiles: RuleProfile[]): RuleProfile[] {
  if (profiles.length === 0) {
    return [];
  }

  const byTarget = new Map<string, RuleProfile>();
  profiles.forEach((profile) => {
    const targetIds = profile.targetAppIds.length > 0 ? profile.targetAppIds : [DEFAULT_TARGET_ID];
    targetIds.forEach((rawTargetId) => {
      const targetId = normalizeTargetId(rawTargetId);
      if (!targetId) {
        return;
      }

      const existing = byTarget.get(targetId);
      const dailyLimitMinutes = Math.max(
        1,
        existing ? Math.min(existing.dailyLimitMinutes, profile.dailyLimitMinutes) : profile.dailyLimitMinutes
      );
      byTarget.set(
        targetId,
        toSimpleProfile(targetId, {
          ...profile,
          dailyLimitMinutes
        })
      );
    });
  });

  return [...byTarget.values()].sort((a, b) => a.targetAppIds[0]!.localeCompare(b.targetAppIds[0]!));
}

function createDefaultProfiles(): RuleProfile[] {
  return [];
}

function getProfileById(profiles: RuleProfile[], profileId: string): RuleProfile | undefined {
  return profiles.find((profile) => profile.id === profileId);
}

function getProfileByTargetId(profiles: RuleProfile[], targetId: string): RuleProfile | undefined {
  return profiles.find((profile) => profile.targetAppIds.includes(targetId));
}

function calculateDecision(
  profile: RuleProfile | undefined,
  usage: UsageSnapshot,
  selectedTargetId: string,
  intentConfirmed: boolean,
  delaySatisfied: boolean,
  health?: EnforcementHealth
): EnforcementDecision {
  if (!profile) {
    return {
      kind: "allow",
      reason: "target_not_managed",
      remainingMinutes: 0,
      remainingOpens: 0
    };
  }

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
  liveUsage: LiveAppUsageRow[];
  retentionPolicy: RetentionPolicy;
  intentConfirmed: boolean;
  delaySatisfied: boolean;
  decision: EnforcementDecision;
  isBootstrapped: boolean;
  lastUsageEventCursorIso?: string;
  setActiveTab: (tab: AppTab) => void;
  setActiveProfile: (profileId: string) => void;
  setSelectedTargetId: (targetId: string) => void;
  removeTargetFromEnforcement: (targetId?: string) => Promise<void>;
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
  refreshLiveUsage: () => Promise<void>;
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
  undefined,
  initialUsage,
  DEFAULT_TARGET_ID,
  false,
  false,
  initialHealth
);

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: "onboarding",
  profiles: defaultProfiles,
  activeProfileId: "",
  selectedTargetId: DEFAULT_TARGET_ID,
  usage: initialUsage,
  permissionsGranted: false,
  permissionStates: [],
  health: initialHealth,
  liveUsage: [],
  retentionPolicy: DEFAULT_RETENTION_POLICY,
  intentConfirmed: false,
  delaySatisfied: false,
  decision: initialDecision,
  isBootstrapped: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setActiveProfile: (profileId) => {
    const activeProfile = getProfileById(get().profiles, profileId);
    set({
      activeProfileId: profileId,
      selectedTargetId: activeProfile?.targetAppIds[0] ?? get().selectedTargetId,
      intentConfirmed: false,
      delaySatisfied: false
    });
    get().recomputeDecision();
  },

  setSelectedTargetId: (targetId) => {
    const normalizedTargetId = normalizeTargetId(targetId);
    const matchedProfile = getProfileByTargetId(get().profiles, normalizedTargetId);
    set((state) => ({
      selectedTargetId: normalizedTargetId || state.selectedTargetId,
      activeProfileId: matchedProfile?.id ?? state.activeProfileId,
      intentConfirmed: false,
      delaySatisfied: false
    }));
    get().recomputeDecision();
  },

  removeTargetFromEnforcement: async (targetId) => {
    const target = normalizeTargetId(targetId ?? get().selectedTargetId);
    if (!target) {
      return;
    }

    set((state) => {
      const nextProfiles = state.profiles.filter((profile) => !profile.targetAppIds.includes(target));
      const selectedProfile = getProfileByTargetId(nextProfiles, state.selectedTargetId);
      return {
        profiles: nextProfiles,
        activeProfileId: selectedProfile?.id ?? nextProfiles[0]?.id ?? "",
        intentConfirmed: false,
        delaySatisfied: false
      };
    });

    const state = get();
    const repository = getProfileRepository();
    await repository.replaceProfiles(state.profiles);
    await enforcementService.syncRules(state.profiles);
    await get().refreshLiveUsage();
    get().recomputeDecision();
  },

  setDailyLimitMinutes: (minutes) => {
    const targetId = normalizeTargetId(get().selectedTargetId);
    if (!targetId) {
      return;
    }
    const nextLimit = Math.max(1, minutes);

    set((state) => {
      const existingProfile = getProfileByTargetId(state.profiles, targetId);
      if (existingProfile) {
        return {
          profiles: state.profiles.map((profile) =>
            profile.id === existingProfile.id
              ? {
                  ...profile,
                  dailyLimitMinutes: nextLimit,
                  revision: profile.revision + 1,
                  updatedAtIso: nowIso()
                }
              : profile
          ),
          activeProfileId: existingProfile.id,
          intentConfirmed: false,
          delaySatisfied: false
        };
      }

      const nextProfile = createSimpleProfile(targetId, nextLimit);
      return {
        profiles: [...state.profiles, nextProfile],
        activeProfileId: nextProfile.id,
        intentConfirmed: false,
        delaySatisfied: false
      };
    });

    const state = get();
    const repository = getProfileRepository();
    void repository
      .replaceProfiles(state.profiles)
      .then(() => enforcementService.syncRules(state.profiles));

    get().recomputeDecision();
  },

  setDailyOpenLimit: (opens) => {
    const nextLimit = Math.max(1, opens);
    const targetId = normalizeTargetId(get().selectedTargetId);
    if (!targetId) {
      return;
    }
    set((state) => {
      const existingProfile = getProfileByTargetId(state.profiles, targetId);
      if (!existingProfile) {
        return {};
      }
      return {
        profiles: state.profiles.map((profile) =>
          profile.id === existingProfile.id
            ? {
                ...profile,
                dailyOpenLimit: nextLimit,
                revision: profile.revision + 1,
                updatedAtIso: nowIso()
              }
            : profile
        )
      };
    });

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
    const activeProfile =
      getProfileByTargetId(state.profiles, state.selectedTargetId) ??
      getProfileById(state.profiles, state.activeProfileId);
    if (!activeProfile) {
      return;
    }
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

    const storedProfiles = await repository.getProfiles();
    let profiles = normalizeProfiles(storedProfiles);
    if (JSON.stringify(profiles) !== JSON.stringify(storedProfiles)) {
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

    const activeProfileId = profiles[0]?.id ?? "";
    const selectedTargetId =
      profiles[0]?.targetAppIds[0] ?? DEFAULT_TARGET_ID;

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
    await get().refreshLiveUsage();
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

  refreshLiveUsage: async () => {
    const rows = await enforcementService.getLiveAppUsage();
    const sortedRows = [...rows].sort((a, b) => {
      if (a.enforced !== b.enforced) {
        return a.enforced ? -1 : 1;
      }
      if (b.minutesUsedToday !== a.minutesUsedToday) {
        return b.minutesUsedToday - a.minutesUsedToday;
      }
      return a.displayName.localeCompare(b.displayName);
    });
    set({ liveUsage: sortedRows });
  },

  startEnforcement: async () => {
    const state = get();
    await enforcementService.startEnforcement(state.profiles);
    const health = await enforcementService.getHealth();
    set({ health });
    get().recomputeDecision();
    await get().refreshLiveUsage();
  },

  stopEnforcement: async () => {
    await enforcementService.stopEnforcement();
    const health = await enforcementService.getHealth();
    set({ health });
    get().recomputeDecision();
    await get().refreshLiveUsage();
  },

  recomputeDecision: () => {
    const state = get();
    const activeProfile =
      getProfileByTargetId(state.profiles, state.selectedTargetId) ??
      getProfileById(state.profiles, state.activeProfileId);
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
