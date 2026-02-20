import { DatabaseSync } from "node:sqlite";

import type { SqliteClient } from "../src/sql/migrations";

export class NodeSqliteClient implements SqliteClient {
  private readonly db: DatabaseSync;
  private closed = false;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  async exec(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length === 0) {
      this.db.exec(sql);
      return;
    }

    this.db.prepare(sql).run(...params);
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...params) as T | undefined;
    return row ?? null;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.db.exec("BEGIN");
    try {
      const result = await fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.db.close();
    this.closed = true;
  }
}
