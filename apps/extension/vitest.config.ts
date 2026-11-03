import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default mergeConfig(
  base,
  defineConfig({
    // Runs WXT's build setup in tests and swaps `browser` for an in-memory fake
    // (@webext-core/fake-browser); tests reset it with fakeBrowser.reset().
    plugins: [WxtVitest()],
    test: {
      environment: 'jsdom',
      testTimeout: 15_000,
      setupFiles: ['./src/test-setup.ts'],
      // UTC+14 like the other packages: anything leaking the machine's zone shows up.
      env: { TZ: 'Pacific/Kiritimati' },
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        // Entrypoints only wire listeners and mount React; their parts are tested.
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/entrypoints/**',
          'src/ui/mount.tsx',
          'src/test-utils/**',
          'src/test-setup.ts',
        ],
        reporter: ['text', 'html'],
        thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  }),
);
