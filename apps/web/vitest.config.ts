import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  mergeConfig(viteConfig, base),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      // Stylesheets are tested separately (tokens only); components don't need them here.
      css: false,
    },
  }),
);
