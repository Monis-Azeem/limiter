import type {
  AuditEvent,
  RetentionPolicy,
  RuleProfile,
  UsageEvent,
  UsageSnapshot,
  Weekday
} from "@boundly/domain";
import { createEmptyUsageSnapshot } from "@boundly/domain";

import { runMigrations, type SqliteClient } from "../sql/migrations";
import type { ProfileRepository } from "./profile-repository";

const RETENTION_POLICY_KEY = "retention_policy";
const OVERRIDE_COUNT_KEY = "override_count_today";
const LAST_OVERRIDE_AT_KEY = "last_override_at_iso";

interface SqlProfileRow {
  id: string;
  name: string;
  revision: number;
  updated_at_iso: string;
  enabled: number;
  daily_limit_minutes: number;
  daily_open_limit: number;
  override_policy_json: string;
  friction_policy_json: string;
}

interface SqlTargetRow {
  profile_id: string;
  target_app_id: string;
}

interface SqlWindowRow {
  id: string;
  profile_id: string;
  days_csv: string;
  start_minute: number;
  end_minute: number;
}

interface SqlUsageDailyRow {
  target_app_id: string;
  minutes_used: number;
  opens_used: number;
}

interface SqlUsageEventRow {
  id: string;
  target_app_id: string;
  occurred_at_iso: string;
  event_type: string;
  minutes_delta: number | null;
  opens_delta: number | null;
  metadata_json: string | null;
}

interface SqlAuditEventRow {
  id: string;
  event_type: string;
  severity: "info" | "warning" | "error";
  message: string;
  occurred_at_iso: string;
  metadata_json: string | null;
}

type ClockFn = () => Date;

function toDayIso(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDays(daysCsv: string): Weekday[] {
  return daysCsv
    .split(",")
    .map((day) => day.trim())
    .filter((day): day is Weekday =>
      ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].includes(day)
    );
}

function stringifyMetadata(metadata?: Record<string, string>): string | null {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return JSON.stringify(metadata);
}

function parseMetadata(value: string | null): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed;
  } catch {
    return undefined;
  }
}

export class SqliteProfileRepository implements ProfileRepository {
  private didMigrate = false;

  constructor(
    private readonly client: SqliteClient,
    private readonly clock: ClockFn = () => new Date()
  ) {}

  private async ensureMigrations(): Promise<void> {
    if (this.didMigrate) {
      return;
    }

    await runMigrations(this.client);
    this.didMigrate = true;
  }

  private async getMeta(key: string): Promise<string | null> {
    const row = await this.client.first<{ value: string }>(
      "SELECT value FROM meta WHERE key = ?",
      [key]
    );
    return row?.value ?? null;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await this.client.exec(
      "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
      [key, value]
    );
  }

  async getProfiles(): Promise<RuleProfile[]> {
    await this.ensureMigrations();

    const profileRows = await this.client.all<SqlProfileRow>(
      "SELECT * FROM profiles ORDER BY name ASC"
    );
    if (profileRows.length === 0) {
      return [];
    }

    const targetRows = await this.client.all<SqlTargetRow>(
      "SELECT profile_id, target_app_id FROM profile_targets"
    );
    const windowRows = await this.client.all<SqlWindowRow>(
      "SELECT id, profile_id, days_csv, start_minute, end_minute FROM windows"
    );

    const targetsByProfile = new Map<string, string[]>();
    for (const targetRow of targetRows) {
      const targets = targetsByProfile.get(targetRow.profile_id) ?? [];
      targets.push(targetRow.target_app_id);
      targetsByProfile.set(targetRow.profile_id, targets);
    }

    const windowsByProfile = new Map<string, RuleProfile["windows"]>();
    for (const windowRow of windowRows) {
      const windows = windowsByProfile.get(windowRow.profile_id) ?? [];
      windows.push({
        id: windowRow.id,
        days: parseDays(windowRow.days_csv),
        startMinute: windowRow.start_minute,
        endMinute: windowRow.end_minute
      });
      windowsByProfile.set(windowRow.profile_id, windows);
    }

    return profileRows.map((profileRow) => ({
      id: profileRow.id,
      name: profileRow.name,
      revision: profileRow.revision,
      updatedAtIso: profileRow.updated_at_iso,
      enabled: profileRow.enabled === 1,
      targetAppIds: targetsByProfile.get(profileRow.id) ?? [],
      windows: windowsByProfile.get(profileRow.id) ?? [],
      dailyLimitMinutes: profileRow.daily_limit_minutes,
      dailyOpenLimit: profileRow.daily_open_limit,
      overridePolicy: JSON.parse(profileRow.override_policy_json),
      frictionPolicy: JSON.parse(profileRow.friction_policy_json)
    }));
  }

  async getProfileById(profileId: string): Promise<RuleProfile | null> {
    const profiles = await this.getProfiles();
    return profiles.find((profile) => profile.id === profileId) ?? null;
  }

  async upsertProfile(profile: RuleProfile): Promise<void> {
    await this.ensureMigrations();

    await this.client.transaction(async () => {
      await this.client.exec(
        "INSERT OR REPLACE INTO profiles (id, name, revision, updated_at_iso, enabled, daily_limit_minutes, daily_open_limit, override_policy_json, friction_policy_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          profile.id,
          profile.name,
          profile.revision,
          profile.updatedAtIso,
          profile.enabled ? 1 : 0,
          profile.dailyLimitMinutes,
          profile.dailyOpenLimit,
          JSON.stringify(profile.overridePolicy),
          JSON.stringify(profile.frictionPolicy)
        ]
      );

      await this.client.exec(
        "DELETE FROM profile_targets WHERE profile_id = ?",
        [profile.id]
      );
      await this.client.exec(
        "DELETE FROM windows WHERE profile_id = ?",
        [profile.id]
      );

      for (const targetAppId of profile.targetAppIds) {
        await this.client.exec(
          "INSERT INTO profile_targets (profile_id, target_app_id) VALUES (?, ?)",
          [profile.id, targetAppId]
        );
      }

      for (const window of profile.windows) {
        await this.client.exec(
          "INSERT INTO windows (id, profile_id, days_csv, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)",
          [
            window.id,
            profile.id,
            window.days.join(","),
            window.startMinute,
            window.endMinute
          ]
        );
      }
    });
  }

  async replaceProfiles(profiles: RuleProfile[]): Promise<void> {
    await this.ensureMigrations();

    await this.client.transaction(async () => {
      await this.client.exec("DELETE FROM profile_targets");
      await this.client.exec("DELETE FROM windows");
      await this.client.exec("DELETE FROM profiles");

      for (const profile of profiles) {
        await this.client.exec(
          "INSERT OR REPLACE INTO profiles (id, name, revision, updated_at_iso, enabled, daily_limit_minutes, daily_open_limit, override_policy_json, friction_policy_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            profile.id,
            profile.name,
            profile.revision,
            profile.updatedAtIso,
            profile.enabled ? 1 : 0,
            profile.dailyLimitMinutes,
            profile.dailyOpenLimit,
            JSON.stringify(profile.overridePolicy),
            JSON.stringify(profile.frictionPolicy)
          ]
        );

        for (const targetAppId of profile.targetAppIds) {
          await this.client.exec(
            "INSERT INTO profile_targets (profile_id, target_app_id) VALUES (?, ?)",
            [profile.id, targetAppId]
          );
        }

        for (const window of profile.windows) {
          await this.client.exec(
            "INSERT INTO windows (id, profile_id, days_csv, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)",
            [
              window.id,
              profile.id,
              window.days.join(","),
              window.startMinute,
              window.endMinute
            ]
          );
        }
      }
    });
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.ensureMigrations();
    await this.client.exec("DELETE FROM profiles WHERE id = ?", [profileId]);
    await this.client.exec("DELETE FROM profile_targets WHERE profile_id = ?", [profileId]);
    await this.client.exec("DELETE FROM windows WHERE profile_id = ?", [profileId]);
  }

  async getUsageSnapshot(): Promise<UsageSnapshot> {
    await this.ensureMigrations();

    const now = this.clock();
    const dayIso = toDayIso(now);
    const usageRows = await this.client.all<SqlUsageDailyRow>(
      "SELECT target_app_id, minutes_used, opens_used FROM usage_daily WHERE day_iso = ?",
      [dayIso]
    );

    const snapshot = createEmptyUsageSnapshot();
    for (const usageRow of usageRows) {
      snapshot.minutesByTarget[usageRow.target_app_id] = usageRow.minutes_used;
      snapshot.opensByTarget[usageRow.target_app_id] = usageRow.opens_used;
    }

    snapshot.overridesUsedToday = Number.parseInt(
      (await this.getMeta(OVERRIDE_COUNT_KEY)) ?? "0",
      10
    );
    const lastOverrideAtIso = await this.getMeta(LAST_OVERRIDE_AT_KEY);
    if (lastOverrideAtIso) {
      snapshot.lastOverrideAtIso = lastOverrideAtIso;
    }

    return snapshot;
  }

  async saveUsageSnapshot(snapshot: UsageSnapshot): Promise<void> {
    await this.ensureMigrations();

    const dayIso = toDayIso(this.clock());
    await this.client.transaction(async () => {
      await this.client.exec("DELETE FROM usage_daily WHERE day_iso = ?", [dayIso]);
      const targetIds = new Set([
        ...Object.keys(snapshot.minutesByTarget),
        ...Object.keys(snapshot.opensByTarget)
      ]);

      for (const targetId of targetIds) {
        await this.client.exec(
          "INSERT OR REPLACE INTO usage_daily (day_iso, target_app_id, minutes_used, opens_used) VALUES (?, ?, ?, ?)",
          [
            dayIso,
            targetId,
            snapshot.minutesByTarget[targetId] ?? 0,
            snapshot.opensByTarget[targetId] ?? 0
          ]
        );
      }

      await this.setMeta(OVERRIDE_COUNT_KEY, String(snapshot.overridesUsedToday));
      if (snapshot.lastOverrideAtIso) {
        await this.setMeta(LAST_OVERRIDE_AT_KEY, snapshot.lastOverrideAtIso);
      }
    });
  }

  async saveUsageEvents(events: UsageEvent[]): Promise<void> {
    await this.ensureMigrations();
    if (events.length === 0) {
      return;
    }

    await this.client.transaction(async () => {
      for (const event of events) {
        await this.client.exec(
          "INSERT OR REPLACE INTO usage_events (id, target_app_id, occurred_at_iso, event_type, minutes_delta, opens_delta, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            event.id,
            event.targetAppId,
            event.occurredAtIso,
            event.eventType,
            event.minutesDelta ?? null,
            event.opensDelta ?? null,
            stringifyMetadata(event.metadata)
          ]
        );

        const eventDayIso = toDayIso(new Date(event.occurredAtIso));
        await this.client.exec(
          "INSERT OR IGNORE INTO usage_daily (day_iso, target_app_id, minutes_used, opens_used) VALUES (?, ?, 0, 0)",
          [eventDayIso, event.targetAppId]
        );
        await this.client.exec(
          "UPDATE usage_daily SET minutes_used = minutes_used + ?, opens_used = opens_used + ? WHERE day_iso = ? AND target_app_id = ?",
          [
            event.minutesDelta ?? 0,
            event.opensDelta ?? 0,
            eventDayIso,
            event.targetAppId
          ]
        );
      }
    });
  }

  async getUsageEventsSince(sinceIso: string): Promise<UsageEvent[]> {
    await this.ensureMigrations();

    const rows = await this.client.all<SqlUsageEventRow>(
      "SELECT id, target_app_id, occurred_at_iso, event_type, minutes_delta, opens_delta, metadata_json FROM usage_events WHERE occurred_at_iso >= ? ORDER BY occurred_at_iso ASC",
      [sinceIso]
    );

    return rows.map((row) => {
      const event: UsageEvent = {
        id: row.id,
        targetAppId: row.target_app_id,
        occurredAtIso: row.occurred_at_iso,
        eventType: row.event_type as UsageEvent["eventType"]
      };

      if (row.minutes_delta !== null) {
        event.minutesDelta = row.minutes_delta;
      }
      if (row.opens_delta !== null) {
        event.opensDelta = row.opens_delta;
      }
      const metadata = parseMetadata(row.metadata_json);
      if (metadata) {
        event.metadata = metadata;
      }

      return event;
    });
  }

  async saveAuditEvent(event: AuditEvent): Promise<void> {
    await this.ensureMigrations();

    await this.client.exec(
      "INSERT OR REPLACE INTO audit_events (id, event_type, severity, message, occurred_at_iso, metadata_json) VALUES (?, ?, ?, ?, ?, ?)",
      [
        event.id,
        event.type,
        event.severity,
        event.message,
        event.occurredAtIso,
        stringifyMetadata(event.metadata)
      ]
    );
  }

  async getAuditEventsSince(sinceIso: string): Promise<AuditEvent[]> {
    await this.ensureMigrations();

    const rows = await this.client.all<SqlAuditEventRow>(
      "SELECT id, event_type, severity, message, occurred_at_iso, metadata_json FROM audit_events WHERE occurred_at_iso >= ? ORDER BY occurred_at_iso ASC",
      [sinceIso]
    );

    return rows.map((row) => {
      const auditEvent: AuditEvent = {
        id: row.id,
        type: row.event_type,
        severity: row.severity,
        message: row.message,
        occurredAtIso: row.occurred_at_iso
      };

      const metadata = parseMetadata(row.metadata_json);
      if (metadata) {
        auditEvent.metadata = metadata;
      }

      return auditEvent;
    });
  }

  async getRetentionPolicy(): Promise<RetentionPolicy> {
    await this.ensureMigrations();
    const raw = await this.getMeta(RETENTION_POLICY_KEY);
    if (!raw) {
      return {
        usageDays: 30,
        auditDays: 30
      };
    }

    try {
      return JSON.parse(raw) as RetentionPolicy;
    } catch {
      return {
        usageDays: 30,
        auditDays: 30
      };
    }
  }

  async setRetentionPolicy(policy: RetentionPolicy): Promise<void> {
    await this.ensureMigrations();
    await this.setMeta(RETENTION_POLICY_KEY, JSON.stringify(policy));
  }

  async pruneOlderThan(cutoffIso: string): Promise<void> {
    await this.ensureMigrations();

    const cutoffDay = toDayIso(new Date(cutoffIso));
    await this.client.transaction(async () => {
      await this.client.exec(
        "DELETE FROM usage_events WHERE occurred_at_iso < ?",
        [cutoffIso]
      );
      await this.client.exec(
        "DELETE FROM audit_events WHERE occurred_at_iso < ?",
        [cutoffIso]
      );
      await this.client.exec(
        "DELETE FROM usage_daily WHERE day_iso < ?",
        [cutoffDay]
      );
    });
  }
}
