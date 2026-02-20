import { SqliteProfileRepository, type ProfileRepository } from "@boundly/persistence";

import { ExpoSqliteClient } from "./expo-sqlite-client";

let repository: ProfileRepository | null = null;

export function getProfileRepository(): ProfileRepository {
  if (repository) {
    return repository;
  }

  repository = new SqliteProfileRepository(new ExpoSqliteClient("boundly.db"));
  return repository;
}
