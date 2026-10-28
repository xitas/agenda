import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeIfUnlocked } from './db-files.ts';

/** Removes databases that earlier runs could not delete (see global-teardown.ts). */
export default async function globalSetup(): Promise<void> {
  const current = process.env.E2E_DB_FILE;
  const stale = (await readdir(tmpdir()))
    .filter((name) => name.startsWith('agenda-e2e-'))
    .map((name) => join(tmpdir(), name))
    .filter((path) => current === undefined || !path.startsWith(current));
  await Promise.all(stale.map(removeIfUnlocked));
}
