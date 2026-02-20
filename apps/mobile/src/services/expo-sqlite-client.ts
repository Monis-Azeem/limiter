import * as SQLite from "expo-sqlite";

import type { SqliteClient } from "@boundly/persistence";

export class ExpoSqliteClient implements SqliteClient {
  private dbPromise: Promise<SQLite.SQLiteDatabase>;

  constructor(databaseName = "boundly.db") {
    this.dbPromise = SQLite.openDatabaseAsync(databaseName);
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    return this.dbPromise;
  }

  async exec(sql: string, params: unknown[] = []): Promise<void> {
    const db = await this.getDb();
    if (params.length === 0) {
      await db.execAsync(sql);
      return;
    }

    await db.runAsync(sql, params as SQLite.SQLiteBindParams);
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.getDb();
    return db.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  async first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams);
    return result ?? null;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = await this.getDb();
    await db.execAsync("BEGIN");
    try {
      const result = await fn();
      await db.execAsync("COMMIT");
      return result;
    } catch (error) {
      await db.execAsync("ROLLBACK");
      throw error;
    }
  }
}
