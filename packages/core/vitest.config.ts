import base from '@agenda/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // UTC+14: any code that accidentally uses the host time zone gets the wrong day.
      env: { TZ: 'Pacific/Kiritimati' },
    },
  }),
);
