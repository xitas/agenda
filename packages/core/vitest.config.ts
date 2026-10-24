import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // UTC+14: any code that accidentally uses the host time zone gets the wrong day.
      env: { TZ: 'Pacific/Kiritimati' },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/__fixtures__/**'],
        reporter: ['text', 'html'],
        // core holds the logic every app depends on (ARCHITECTURE.md section 8).
        thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  }),
);
