import type { RuleProfile, UsageSnapshot } from "../models/types";

export interface OverrideResult {
  updatedUsage: UsageSnapshot;
  cooldownUntilIso: string;
  minutesAfterPenalty: number;
}

export function applyOverride(
  profile: RuleProfile,
  usage: UsageSnapshot,
  targetAppId: string,
  nowIso: string
): OverrideResult {
  const now = new Date(nowIso);
  if (Number.isNaN(now.valueOf())) {
    throw new Error(`Invalid ISO timestamp: ${nowIso}`);
  }

  const minutesUsed = usage.minutesByTarget[targetAppId] ?? 0;
  const minutesAfterPenalty = minutesUsed + profile.overridePolicy.penaltyMinutes;
  const cooldownUntilIso = new Date(
    now.getTime() + profile.overridePolicy.cooldownMinutes * 60_000
  ).toISOString();

  return {
    updatedUsage: {
      ...usage,
      minutesByTarget: {
        ...usage.minutesByTarget,
        [targetAppId]: minutesAfterPenalty
      },
      overridesUsedToday: usage.overridesUsedToday + 1,
      lastOverrideAtIso: now.toISOString()
    },
    cooldownUntilIso,
    minutesAfterPenalty
  };
}
