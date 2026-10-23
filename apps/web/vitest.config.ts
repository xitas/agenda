import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  mergeConfig(viteConfig, base),
  defineConfig({ test: { environment: 'jsdom' } }),
);
