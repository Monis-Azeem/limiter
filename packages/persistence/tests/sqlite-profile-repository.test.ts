import { afterEach, describe, expect, it } from "vitest";

import type { RuleProfile, UsageEvent } from "@boundly/domain";

import { SqliteProfileRepository } from "../src/repositories/sqlite-profile-repository";
import { NodeSqliteClient } from "./node-sqlite-client";

function buildProfile(): RuleProfile {
  return {
    id: "work",
    name: "Work",
    revision: 1,
    updatedAtIso: "2026-02-20T00:00:00.000Z",
    enabled: true,
    targetAppIds: ["instagram", "youtube"],
    windows: [
      {
        id: "work-window",
        days: ["mon", "tue", "wed", "thu", "fri"],
        startMinute: 9 * 60,
        endMinute: 18 * 60
      }
    ],
    dailyLimitMinutes: 45,
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

describe("SqliteProfileRepository", () => {
  const clients: NodeSqliteClient[] = [];

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
  });

  it("persists and reads profiles", async () => {
    const client = new NodeSqliteClient();
    clients.push(client);
    const repository = new SqliteProfileRepository(client);

    await repository.upsertProfile(buildProfile());
    const profiles = await repository.getProfiles();

    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.id).toBe("work");
    expect(profiles[0]?.targetAppIds).toEqual(["instagram", "youtube"]);
    expect(profiles[0]?.windows[0]?.days).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri"
    ]);
  });

  it("applies usage events to daily usage snapshot", async () => {
    const now = new Date("2026-02-20T11:00:00.000Z");
    const client = new NodeSqliteClient();
    clients.push(client);
    const repository = new SqliteProfileRepository(client, () => now);

    const events: UsageEvent[] = [
      {
        id: "event-1",
        targetAppId: "instagram",
        occurredAtIso: "2026-02-20T10:00:00.000Z",
        eventType: "open",
        opensDelta: 1
      },
      {
        id: "event-2",
        targetAppId: "instagram",
        occurredAtIso: "2026-02-20T10:05:00.000Z",
        eventType: "usage_update",
        minutesDelta: 5
      }
    ];

    await repository.saveUsageEvents(events);
    const snapshot = await repository.getUsageSnapshot();

    expect(snapshot.opensByTarget.instagram).toBe(1);
    expect(snapshot.minutesByTarget.instagram).toBe(5);
  });

  it("prunes usage and audit rows older than retention cutoff", async () => {
    const now = new Date("2026-02-20T12:00:00.000Z");
    const client = new NodeSqliteClient();
    clients.push(client);
    const repository = new SqliteProfileRepository(client, () => now);

    await repository.saveUsageEvents([
      {
        id: "old-usage",
        targetAppId: "instagram",
        occurredAtIso: "2026-01-01T12:00:00.000Z",
        eventType: "usage_update",
        minutesDelta: 3
      },
      {
        id: "new-usage",
        targetAppId: "instagram",
        occurredAtIso: "2026-02-20T11:00:00.000Z",
        eventType: "usage_update",
        minutesDelta: 4
      }
    ]);

    await repository.saveAuditEvent({
      id: "old-audit",
      type: "permission_check",
      severity: "warning",
      message: "Missing permission",
      occurredAtIso: "2026-01-05T12:00:00.000Z"
    });
    await repository.saveAuditEvent({
      id: "new-audit",
      type: "permission_check",
      severity: "info",
      message: "Permission ok",
      occurredAtIso: "2026-02-20T11:00:00.000Z"
    });

    await repository.pruneOlderThan("2026-02-01T00:00:00.000Z");

    const usage = await repository.getUsageEventsSince("2026-01-01T00:00:00.000Z");
    const audits = await repository.getAuditEventsSince("2026-01-01T00:00:00.000Z");

    expect(usage.map((event) => event.id)).toEqual(["new-usage"]);
    expect(audits.map((event) => event.id)).toEqual(["new-audit"]);
  });

  it("recreates schema on fresh repository instance and preserves readable state", async () => {
    const client = new NodeSqliteClient();
    clients.push(client);

    const repositoryA = new SqliteProfileRepository(client);
    await repositoryA.upsertProfile(buildProfile());
    await client.exec("DROP TABLE windows;");

    const repositoryB = new SqliteProfileRepository(client);
    const profiles = await repositoryB.getProfiles();
    expect(profiles[0]?.id).toBe("work");
    expect(profiles[0]?.windows).toEqual([]);
  });
});
