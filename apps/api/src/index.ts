import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openMigratedDb } from './db/open.js';
import { loadServerEnv } from './env.js';
import type { ServerEnv } from './env.js';

let env: ServerEnv;
try {
  env = loadServerEnv(process.env);
} catch (error) {
  // Refuse to start: without a password hash the API would be unusable (or worse, open).
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Migrations run on every start: a single SQLite node, so there is no deploy race.
const db = await openMigratedDb(env.DATABASE_URL);
const app = createApp({
  db,
  auth: {
    passwordHash: env.AGENDA_PASSWORD_HASH,
    corsOrigins: env.CORS_ORIGINS,
    secureCookies: env.NODE_ENV !== 'development',
  },
  logRequests: true,
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Agenda API listening on http://localhost:${String(info.port)}/api/v1`);
  if (env.NODE_ENV === 'development') console.log('Development mode: cookies are not Secure.');
});
