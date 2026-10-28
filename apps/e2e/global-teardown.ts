import { dbFiles, removeIfUnlocked } from './db-files.ts';

/** Deletes the run's database (and SQLite's side files) after the tests. */
export default async function globalTeardown(): Promise<void> {
  const file = process.env.E2E_DB_FILE;
  if (file === undefined) return;
  // On Windows the API, which Playwright stops after this, may still hold the file open.
  // A locked file is left for the next run's setup to remove.
  await Promise.all(dbFiles(file).map(removeIfUnlocked));
}
