import { loadEnv } from '../env.js';
import { createEventRepo } from '../events/repo.js';
import { openMigratedDb } from './open.js';
import { buildSeedEvents } from './seed-data.js';

// Usage: pnpm --filter @agenda/api db:seed [time zone]   (defaults to this machine's zone)
const { DATABASE_URL } = loadEnv(process.env);
const timezone = process.argv[2] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
const repo = createEventRepo(await openMigratedDb(DATABASE_URL));

if ((await repo.all()).length > 0) {
  console.log('The database already has events; nothing seeded.');
} else {
  const events = buildSeedEvents(new Date(), timezone);
  await repo.insertMany(events);
  console.log(`Seeded ${String(events.length)} events in ${timezone} into ${DATABASE_URL}`);
}
