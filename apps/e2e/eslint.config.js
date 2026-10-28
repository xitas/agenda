// @ts-check
import base from '@agenda/config/eslint/base';
import { defineConfig } from 'eslint/config';

export default defineConfig(base, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});
