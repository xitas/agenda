// @ts-check
import react from '@agenda/config/eslint/react';
import { defineConfig } from 'eslint/config';

export default defineConfig(react, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});
