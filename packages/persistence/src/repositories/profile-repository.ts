import type {
  AuditEvent,
  RetentionPolicy,
  RuleProfile,
  UsageEvent,
  UsageSnapshot
} from "@boundly/domain";

export interface ProfileRepository {
  getProfiles(): Promise<RuleProfile[]>;
  getProfileById(profileId: string): Promise<RuleProfile | null>;
  upsertProfile(profile: RuleProfile): Promise<void>;
  replaceProfiles(profiles: RuleProfile[]): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;
  getUsageSnapshot(): Promise<UsageSnapshot>;
  saveUsageSnapshot(snapshot: UsageSnapshot): Promise<void>;
  saveUsageEvents(events: UsageEvent[]): Promise<void>;
  getUsageEventsSince(sinceIso: string): Promise<UsageEvent[]>;
  saveAuditEvent(event: AuditEvent): Promise<void>;
  getAuditEventsSince(sinceIso: string): Promise<AuditEvent[]>;
  getRetentionPolicy(): Promise<RetentionPolicy>;
  setRetentionPolicy(policy: RetentionPolicy): Promise<void>;
  pruneOlderThan(cutoffIso: string): Promise<void>;
}
