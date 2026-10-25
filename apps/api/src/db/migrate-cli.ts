import { loadEnv } from '../env.js';
import { openMigratedDb } from './open.js';

const { DATABASE_URL } = loadEnv(process.env);
await openMigratedDb(DATABASE_URL);
console.log(`Migrations applied to ${DATABASE_URL}`);
