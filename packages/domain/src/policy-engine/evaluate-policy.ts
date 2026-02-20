import type {
  EnforcementDecision,
  PolicyEvaluationInput
} from "../models/types";
import { isProfileActive } from "./time";

function buildDecision(
  partial: Omit<EnforcementDecision, "remainingMinutes" | "remainingOpens"> &
    Pick<EnforcementDecision, "remainingMinutes" | "remainingOpens">
): EnforcementDecision {
  return {
    ...partial
  };
}

function toDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid ISO timestamp: ${iso}`);
  }
  return date;
}

export function evaluatePolicy(input: PolicyEvaluationInput): EnforcementDecision {
  const now = toDate(input.nowIso);
  const { profile, usage, targetAppId, attempt, context } = input;

  const minutesUsed = usage.minutesByTarget[targetAppId] ?? 0;
  const opensUsed = usage.opensByTarget[targetAppId] ?? 0;
  const remainingMinutes = Math.max(0, profile.dailyLimitMinutes - minutesUsed);
  const remainingOpens = Math.max(0, profile.dailyOpenLimit - opensUsed);

  if (!profile.enabled) {
    return buildDecision({
      kind: "allow",
      reason: "profile_disabled",
      remainingMinutes,
      remainingOpens
    });
  }

  if (!profile.targetAppIds.includes(targetAppId)) {
    return buildDecision({
      kind: "allow",
      reason: "target_not_managed",
      remainingMinutes,
      remainingOpens
    });
  }

  if (context?.health?.status === "permissions_missing") {
    return buildDecision({
      kind: "block",
      reason: "permission_missing",
      remainingMinutes,
      remainingOpens
    });
  }

  if (!isProfileActive(now, profile.windows)) {
    return buildDecision({
      kind: "allow",
      reason: "out_of_schedule",
      remainingMinutes,
      remainingOpens
    });
  }

  if (
    usage.lastOverrideAtIso &&
    profile.overridePolicy.cooldownMinutes > 0 &&
    now.getTime() <
      toDate(usage.lastOverrideAtIso).getTime() +
        profile.overridePolicy.cooldownMinutes * 60_000
  ) {
    const cooldownUntilIso = new Date(
      toDate(usage.lastOverrideAtIso).getTime() +
        profile.overridePolicy.cooldownMinutes * 60_000
    ).toISOString();

    return buildDecision({
      kind: "block",
      reason: "override_cooldown",
      remainingMinutes,
      remainingOpens,
      cooldownUntilIso
    });
  }

  if (minutesUsed >= profile.dailyLimitMinutes) {
    return buildDecision({
      kind: "block",
      reason: "time_limit_reached",
      remainingMinutes,
      remainingOpens
    });
  }

  if (opensUsed >= profile.dailyOpenLimit) {
    return buildDecision({
      kind: "block",
      reason: "open_limit_reached",
      remainingMinutes,
      remainingOpens
    });
  }

  if (profile.frictionPolicy.intentRequired && !attempt.intentConfirmed) {
    return buildDecision({
      kind: "intent",
      reason: "intent_required",
      remainingMinutes,
      remainingOpens
    });
  }

  if (profile.frictionPolicy.delaySeconds > 0 && !attempt.delaySatisfied) {
    return buildDecision({
      kind: "delay",
      reason: "delay_required",
      remainingMinutes,
      remainingOpens,
      delaySeconds: profile.frictionPolicy.delaySeconds
    });
  }

  return buildDecision({
    kind: "allow",
    reason: "within_limits",
    remainingMinutes,
    remainingOpens
  });
}
