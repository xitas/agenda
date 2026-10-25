import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

/** The Drizzle database plus `$client`, the libSQL connection (e.g. to close it). */
export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

/**
 * Opens a libSQL database: `file:./data/agenda.db` in dev, `:memory:` in tests, or a
 * Turso URL later. With `:memory:` each transaction would get a fresh, empty connection,
 * so the API uses `db.batch()` for atomic writes instead of transactions.
 */
export function openDb(url: string): Db {
  return drizzle(createClient({ url }), { schema });
}
