import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-utils/setup.ts'],
      // UTC+14, as in core: EventCard times must come from the timezone prop, not the host.
      env: { TZ: 'Pacific/Kiritimati' },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test-utils/**', 'src/scripts/**'],
        reporter: ['text', 'html'],
        thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  }),
);
