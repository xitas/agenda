// @ts-check
import { defineConfig } from 'eslint/config';
import base from './eslint/base.js';

export default defineConfig(base, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});
