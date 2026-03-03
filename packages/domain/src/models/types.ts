export const WEEKDAYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat"
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface AppTarget {
  id: string;
  displayName: string;
  platformPackageId: string;
}

export interface LiveAppUsageRow {
  appId: string;
  displayName: string;
  platformPackageId: string;
  minutesUsedToday: number;
  enforced: boolean;
  blockedNow: boolean;
  dailyLimitMinutes?: number;
  remainingMinutes?: number;
}

export type PermissionKey =
  | "usage_access"
  | "accessibility"
  | "ignore_battery_optimization"
  | "overlay"
  | "notifications";

export interface PermissionState {
  key: PermissionKey;
  granted: boolean;
  checkedAtIso: string;
  detail?: string;
}

export type EnforcementHealthStatus =
  | "permissions_missing"
  | "enforcement_running"
  | "enforcement_degraded"
  | "enforcement_stopped";

export interface EnforcementHealth {
  status: EnforcementHealthStatus;
  missingPermissions: PermissionKey[];
  lastHeartbeatIso?: string;
  detail?: string;
}

export type UsageEventType = "open" | "usage_update" | "blocked" | "unblocked";

export interface UsageEvent {
  id: string;
  targetAppId: string;
  occurredAtIso: string;
  eventType: UsageEventType;
  minutesDelta?: number;
  opensDelta?: number;
  metadata?: Record<string, string>;
}

export type AuditSeverity = "info" | "warning" | "error";

export interface AuditEvent {
  id: string;
  type: string;
  severity: AuditSeverity;
  message: string;
  occurredAtIso: string;
  metadata?: Record<string, string>;
}

export interface RetentionPolicy {
  usageDays: number;
  auditDays: number;
  lastPrunedAtIso?: string;
}

export interface EnforcementWindow {
  id: string;
  days: Weekday[];
  startMinute: number;
  endMinute: number;
}

export interface OverridePolicy {
  maxOverridesPerDay: number;
  penaltyMinutes: number;
  cooldownMinutes: number;
}

export interface FrictionPolicy {
  intentRequired: boolean;
  delaySeconds: number;
}

export interface RuleProfile {
  id: string;
  name: string;
  revision: number;
  updatedAtIso: string;
  enabled: boolean;
  targetAppIds: string[];
  windows: EnforcementWindow[];
  dailyLimitMinutes: number;
  // Deprecated: open-based enforcement is disabled in v1.1.x (time-based only).
  dailyOpenLimit: number;
  overridePolicy: OverridePolicy;
  frictionPolicy: FrictionPolicy;
}

export interface UsageSnapshot {
  minutesByTarget: Record<string, number>;
  // Deprecated: open-based enforcement is disabled in v1.1.x (time-based only).
  opensByTarget: Record<string, number>;
  overridesUsedToday: number;
  lastOverrideAtIso?: string;
}

export interface AttemptContext {
  intentConfirmed: boolean;
  delaySatisfied: boolean;
}

export interface PolicyEvaluationContext {
  health?: EnforcementHealth;
}

export type DecisionKind = "allow" | "intent" | "delay" | "block";

export type DecisionReason =
  | "profile_disabled"
  | "target_not_managed"
  | "out_of_schedule"
  | "time_limit_reached"
  | "open_limit_reached"
  | "intent_required"
  | "delay_required"
  | "permission_missing"
  | "override_cooldown"
  | "override_quota_exhausted"
  | "within_limits";

export interface PolicyEvaluationInput {
  nowIso: string;
  targetAppId: string;
  profile: RuleProfile;
  usage: UsageSnapshot;
  attempt: AttemptContext;
  context?: PolicyEvaluationContext;
}

export interface EnforcementDecision {
  kind: DecisionKind;
  reason: DecisionReason;
  remainingMinutes: number;
  // Deprecated: open-based enforcement is disabled in v1.1.x (time-based only).
  remainingOpens: number;
  delaySeconds?: number;
  cooldownUntilIso?: string;
}

export function createEmptyUsageSnapshot(): UsageSnapshot {
  return {
    minutesByTarget: {},
    opensByTarget: {},
    overridesUsedToday: 0
  };
}
