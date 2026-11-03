import type { ExpoConfig } from 'expo/config';

// The app's native configuration. `expo run:android` (or `expo prebuild`) generates the
// android/ project from this; android/ itself is not committed.
const config: ExpoConfig = {
  name: 'Agenda',
  slug: 'agenda',
  scheme: 'agenda',
  version: '0.1.0',
  platforms: ['android'],
  userInterfaceStyle: 'automatic',
  icon: '../web/public/pwa-512x512.png',
  android: {
    package: 'io.github.xitas.agenda',
    adaptiveIcon: {
      foregroundImage: '../web/public/maskable-icon-512x512.png',
      backgroundColor: '#4F46E5',
    },
    permissions: [
      // Reminders fire at their minute even while the phone dozes. Allowed for calendar
      // apps; the app isn't on the Play Store, where this permission is reviewed.
      'android.permission.USE_EXACT_ALARM',
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-notifications', { color: '#4F46E5' }],
    './plugins/with-local-cleartext.js',
  ],
  experiments: { typedRoutes: false },
};

export default config;
