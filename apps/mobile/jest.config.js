// React Native ships untranspiled (Flow) source, so Jest must transform it. jest-expo's
// default pattern skips node_modules except React Native packages, but expects a flat
// node_modules; pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/,
// so the allow-list also matches after that prefix.
const transpiled = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  'expo-.*',
  '@expo-google-fonts/.*',
  'react-navigation',
  '@react-navigation/.*',
  '@gorhom/.*',
  'react-native-.*',
  // Shipped as ES modules only (used by core).
  'uuid',
].join('|');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Reanimated 4 and react-native-worklets ship a resolver that picks their JavaScript
  // implementations over the .native ones, which need the real engine.
  resolver: require.resolve('react-native-reanimated/jest/resolver'),
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transformIgnorePatterns: [`node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?(?:${transpiled})/)`],
  // UTC+14, like the other packages: anything leaking the machine's zone shows up.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!src/test-utils/**',
    '!src/test-setup.ts',
  ],
  coverageThreshold: { global: { lines: 90, branches: 90, functions: 90, statements: 90 } },
};
