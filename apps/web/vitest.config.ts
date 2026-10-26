import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  mergeConfig(viteConfig, base),
  defineConfig({
    test: {
      environment: 'jsdom',
      // Interaction tests (many simulated key presses) under coverage, on a cold run with
      // every package testing in parallel, can pass 5 s; that is load, not a hang.
      testTimeout: 15_000,
      setupFiles: ['./src/test-setup.ts'],
      // Stylesheets are tested separately (tokens only); components don't need them here.
      css: false,
    },
  }),
);
