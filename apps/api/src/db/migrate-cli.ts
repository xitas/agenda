import { loadDbEnv } from '../env.js';
import { openMigratedDb } from './open.js';

const { DATABASE_URL } = loadDbEnv(process.env);
await openMigratedDb(DATABASE_URL);
console.log(`Migrations applied to ${DATABASE_URL}`);
