import type {
  AuditEvent,
  RetentionPolicy,
  RuleProfile,
  UsageEvent,
  UsageSnapshot
} from "@boundly/domain";
import { createEmptyUsageSnapshot } from "@boundly/domain";

import type { ProfileRepository } from "./profile-repository";

export class InMemoryProfileRepository implements ProfileRepository {
  private profiles: RuleProfile[] = [];
  private usage: UsageSnapshot = createEmptyUsageSnapshot();
  private usageEvents: UsageEvent[] = [];
  private auditEvents: AuditEvent[] = [];
  private retentionPolicy: RetentionPolicy = {
    usageDays: 30,
    auditDays: 30
  };

  async getProfiles(): Promise<RuleProfile[]> {
    return this.profiles;
  }

  async getProfileById(profileId: string): Promise<RuleProfile | null> {
    return this.profiles.find((profile) => profile.id === profileId) ?? null;
  }

  async upsertProfile(profile: RuleProfile): Promise<void> {
    const existingIndex = this.profiles.findIndex((item) => item.id === profile.id);
    if (existingIndex < 0) {
      this.profiles.push(profile);
      return;
    }

    this.profiles[existingIndex] = profile;
  }

  async replaceProfiles(profiles: RuleProfile[]): Promise<void> {
    this.profiles = profiles;
  }

  async deleteProfile(profileId: string): Promise<void> {
    this.profiles = this.profiles.filter((profile) => profile.id !== profileId);
  }

  async getUsageSnapshot(): Promise<UsageSnapshot> {
    return this.usage;
  }

  async saveUsageSnapshot(snapshot: UsageSnapshot): Promise<void> {
    this.usage = snapshot;
  }

  async saveUsageEvents(events: UsageEvent[]): Promise<void> {
    this.usageEvents = [...this.usageEvents, ...events];
  }

  async getUsageEventsSince(sinceIso: string): Promise<UsageEvent[]> {
    const sinceTime = new Date(sinceIso).getTime();
    return this.usageEvents.filter(
      (event) => new Date(event.occurredAtIso).getTime() >= sinceTime
    );
  }

  async saveAuditEvent(event: AuditEvent): Promise<void> {
    this.auditEvents.push(event);
  }

  async getAuditEventsSince(sinceIso: string): Promise<AuditEvent[]> {
    const sinceTime = new Date(sinceIso).getTime();
    return this.auditEvents.filter(
      (event) => new Date(event.occurredAtIso).getTime() >= sinceTime
    );
  }

  async getRetentionPolicy(): Promise<RetentionPolicy> {
    return this.retentionPolicy;
  }

  async setRetentionPolicy(policy: RetentionPolicy): Promise<void> {
    this.retentionPolicy = policy;
  }

  async pruneOlderThan(cutoffIso: string): Promise<void> {
    const cutoff = new Date(cutoffIso).getTime();
    this.usageEvents = this.usageEvents.filter(
      (event) => new Date(event.occurredAtIso).getTime() >= cutoff
    );
    this.auditEvents = this.auditEvents.filter(
      (event) => new Date(event.occurredAtIso).getTime() >= cutoff
    );
  }
}
