// @ts-check
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import base from './base.js';

/** Base rules plus React hooks and Fast Refresh checks for browser code. */
export default defineConfig(base, {
  files: ['**/*.{ts,tsx}'],
  extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  languageOptions: { globals: globals.browser },
});
