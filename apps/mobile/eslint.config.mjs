// @ts-check
import base from '@agenda/config/eslint/base';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

// The shared rules plus React hooks. Not the react config: that one adds browser globals
// and Vite's Fast Refresh rule, and this app runs in React Native with Metro.
export default defineConfig(
  {
    ignores: [
      'dist/**',
      'android/**',
      '.expo/**',
      'coverage/**',
      'expo-env.d.ts',
      'jest.config.js',
      'eslint.config.mjs',
    ],
  },
  base,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
  {
    // Jest hoists jest.mock() above the imports, so its factories must load the libraries'
    // own mocks with require(), which is untyped.
    files: ['src/test-setup.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // Expo loads local config plugins with require(), so they are CommonJS (with a Jest test).
    files: ['plugins/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.jest } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
