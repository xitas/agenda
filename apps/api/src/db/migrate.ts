import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Db } from './client.js';

// Two levels up from src/db (dev, tests) or dist/db (build) is apps/api/drizzle.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Applies every migration in apps/api/drizzle that this database hasn't run yet. */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}
