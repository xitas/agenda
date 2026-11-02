// @ts-check
import react from '@agenda/config/eslint/react';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  react,
  {
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
  {
    // Tauri is reached only through the platform adapter (CLAUDE.md), so the browser
    // build never pulls it in and every native call goes past one reviewed file.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/platform/tauri.ts', 'src/platform/tauri.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tauri-apps/*'],
              message: 'Use the Platform adapter (usePlatform) instead of calling Tauri directly.',
            },
          ],
        },
      ],
    },
  },
);
