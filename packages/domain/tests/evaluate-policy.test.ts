import { describe, expect, it } from "vitest";

import { createEmptyUsageSnapshot, evaluatePolicy, type RuleProfile } from "../src";

const ALL_DAYS: RuleProfile["windows"][number]["days"] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat"
];

function buildProfile(): RuleProfile {
  return {
    id: "work",
    name: "Work",
    revision: 1,
    updatedAtIso: "2026-02-20T00:00:00.000Z",
    enabled: true,
    targetAppIds: ["instagram"],
    windows: [
      {
        id: "always-active",
        days: ALL_DAYS,
        startMinute: 0,
        endMinute: 0
      }
    ],
    dailyLimitMinutes: 60,
    dailyOpenLimit: 8,
    overridePolicy: {
      maxOverridesPerDay: 1,
      penaltyMinutes: 15,
      cooldownMinutes: 20
    },
    frictionPolicy: {
      intentRequired: true,
      delaySeconds: 10
    }
  };
}

function localIso(hour: number, minute = 0): string {
  return new Date(2026, 1, 20, hour, minute, 0, 0).toISOString();
}

describe("evaluatePolicy", () => {
  it("allows managed app outside schedule", () => {
    const profile = buildProfile();
    profile.windows = [
      {
        id: "narrow-window",
        days: ALL_DAYS,
        startMinute: 9 * 60,
        endMinute: 10 * 60
      }
    ];

    const decision = evaluatePolicy({
      nowIso: localIso(11, 30),
      targetAppId: "instagram",
      profile,
      usage: createEmptyUsageSnapshot(),
      attempt: {
        intentConfirmed: false,
        delaySatisfied: false
      }
    });

    expect(decision.kind).toBe("allow");
    expect(decision.reason).toBe("out_of_schedule");
  });

  it("returns intent first inside schedule", () => {
    const decision = evaluatePolicy({
      nowIso: localIso(14, 0),
      targetAppId: "instagram",
      profile: buildProfile(),
      usage: createEmptyUsageSnapshot(),
      attempt: {
        intentConfirmed: false,
        delaySatisfied: false
      }
    });

    expect(decision.kind).toBe("intent");
    expect(decision.reason).toBe("intent_required");
  });

  it("returns delay when intent is completed", () => {
    const decision = evaluatePolicy({
      nowIso: localIso(14, 0),
      targetAppId: "instagram",
      profile: buildProfile(),
      usage: createEmptyUsageSnapshot(),
      attempt: {
        intentConfirmed: true,
        delaySatisfied: false
      }
    });

    expect(decision.kind).toBe("delay");
    expect(decision.delaySeconds).toBe(10);
  });

  it("blocks when daily time limit is exceeded", () => {
    const usage = createEmptyUsageSnapshot();
    usage.minutesByTarget.instagram = 60;

    const decision = evaluatePolicy({
      nowIso: localIso(14, 0),
      targetAppId: "instagram",
      profile: buildProfile(),
      usage,
      attempt: {
        intentConfirmed: true,
        delaySatisfied: true
      }
    });

    expect(decision.kind).toBe("block");
    expect(decision.reason).toBe("time_limit_reached");
  });
});
