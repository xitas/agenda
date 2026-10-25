import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from './client.js';
import type { Db } from './client.js';
import { runMigrations } from './migrate.js';

/** Opens the configured database, creating the folder for a local file, and migrates it. */
export async function openMigratedDb(url: string): Promise<Db> {
  if (url.startsWith('file:')) {
    mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
  }
  const db = openDb(url);
  await runMigrations(db);
  return db;
}
