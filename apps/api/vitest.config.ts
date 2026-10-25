import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        // Thin entry points that only wire env, database and server together.
        exclude: ['src/index.ts', 'src/db/migrate-cli.ts', 'src/db/seed.ts', 'src/cli/**'],
        reporter: ['text', 'html'],
        thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  }),
);
