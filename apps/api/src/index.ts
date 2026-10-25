import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openMigratedDb } from './db/open.js';
import { loadEnv } from './env.js';

const env = loadEnv(process.env);
// Migrations run on every start: a single SQLite node, so there is no deploy race.
const db = await openMigratedDb(env.DATABASE_URL);
const app = createApp({ db, logRequests: true });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Agenda API listening on http://localhost:${String(info.port)}/api/v1`);
});
