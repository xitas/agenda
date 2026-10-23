// @ts-check
import { defineConfig } from 'vitest/config';

/** Shared Vitest defaults; packages merge their environment on top. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
