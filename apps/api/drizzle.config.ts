import { defineConfig } from 'drizzle-kit';

// Used only by `pnpm db:generate`; migrations are applied at runtime by src/db/migrate.ts.
export default defineConfig({
  dialect: 'turso',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
