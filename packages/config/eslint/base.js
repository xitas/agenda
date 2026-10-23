// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared rules for every package. Each package's eslint.config.js adds its own
 * `tsconfigRootDir` so type-aware rules find the right tsconfig.json.
 */
export default defineConfig(
  { ignores: ['dist/**', 'coverage/**', '.turbo/**'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true },
    },
  },
  {
    // Plain JS config files are not part of any tsconfig project.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
