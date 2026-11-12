import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '../src/providers';
import { missingRuntimeFeatures } from '../src/runtime-check';
import { usePalette } from '../src/theme';

function Shell() {
  const { scheme, color } = usePalette();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
    </>
  );
}

// In development builds, say early if the engine lacks something core needs.
if (__DEV__) {
  const missing = missingRuntimeFeatures();
  if (missing.length > 0) console.warn(`Missing in this JavaScript engine: ${missing.join(', ')}`);
}

// The root of the app (Expo Router): providers around every route.
export default function RootLayout() {
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
