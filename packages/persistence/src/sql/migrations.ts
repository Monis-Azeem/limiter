export interface SqliteClient {
  exec(sql: string, params?: unknown[]): Promise<void>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

const MIGRATION_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, revision INTEGER NOT NULL, updated_at_iso TEXT NOT NULL, enabled INTEGER NOT NULL, daily_limit_minutes INTEGER NOT NULL, daily_open_limit INTEGER NOT NULL, override_policy_json TEXT NOT NULL, friction_policy_json TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS profile_targets (profile_id TEXT NOT NULL, target_app_id TEXT NOT NULL, PRIMARY KEY (profile_id, target_app_id), FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE);",
  "CREATE TABLE IF NOT EXISTS windows (id TEXT PRIMARY KEY NOT NULL, profile_id TEXT NOT NULL, days_csv TEXT NOT NULL, start_minute INTEGER NOT NULL, end_minute INTEGER NOT NULL, FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE);",
  "CREATE TABLE IF NOT EXISTS usage_daily (day_iso TEXT NOT NULL, target_app_id TEXT NOT NULL, minutes_used INTEGER NOT NULL, opens_used INTEGER NOT NULL, PRIMARY KEY (day_iso, target_app_id));",
  "CREATE TABLE IF NOT EXISTS usage_events (id TEXT PRIMARY KEY NOT NULL, target_app_id TEXT NOT NULL, occurred_at_iso TEXT NOT NULL, event_type TEXT NOT NULL, minutes_delta INTEGER, opens_delta INTEGER, metadata_json TEXT);",
  "CREATE INDEX IF NOT EXISTS idx_usage_events_occurred_at_iso ON usage_events (occurred_at_iso);",
  "CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, occurred_at_iso TEXT NOT NULL, metadata_json TEXT);",
  "CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at_iso ON audit_events (occurred_at_iso);",
  "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);"
];

const SCHEMA_VERSION_KEY = "schema_version";
const SCHEMA_VERSION = 1;

export async function runMigrations(client: SqliteClient): Promise<void> {
  await client.transaction(async () => {
    for (const statement of MIGRATION_STATEMENTS) {
      await client.exec(statement);
    }

    await client.exec(
      "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
      [SCHEMA_VERSION_KEY, String(SCHEMA_VERSION)]
    );
  });
}
