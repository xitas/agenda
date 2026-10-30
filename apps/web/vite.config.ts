/// <reference types="node" />
import { color } from '@agenda/tokens';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// In dev the browser only talks to Vite; /api is forwarded to the API. The app and API
// are then same-origin, so the session cookie works without CORS. Builds use
// VITE_API_URL instead. AGENDA_API_URL moves the target, e.g. for the e2e run's own API.
const proxy = { '/api': process.env.AGENDA_API_URL ?? 'http://localhost:4001' };

/**
 * The browser's title bar color for each scheme, and the icons, from the tokens. (A
 * manifest has only one theme_color, so the light/dark pair goes in the page instead.)
 */
function headTags(): Plugin {
  return {
    name: 'agenda-head-tags',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: {
          name: 'theme-color',
          media: '(prefers-color-scheme: light)',
          content: color.light.bg,
        },
        injectTo: 'head',
      },
      {
        tag: 'meta',
        attrs: {
          name: 'theme-color',
          media: '(prefers-color-scheme: dark)',
          content: color.dark.bg,
        },
        injectTo: 'head',
      },
      {
        tag: 'link',
        attrs: { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        injectTo: 'head',
      },
      {
        tag: 'link',
        attrs: { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        injectTo: 'head',
      },
      {
        tag: 'link',
        attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
        injectTo: 'head',
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    react(),
    headTags(),
    // The PWA: a manifest, and our own service worker (src/sw/sw.ts) given the build's
    // file list to precache. "prompt" means a new version waits for the user's Reload.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt',
      // Registered from main.tsx (registerSW), so the update toast can be ours.
      injectRegister: false,
      manifest: {
        name: 'Agenda',
        short_name: 'Agenda',
        description: 'Your personal agenda and calendar.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: color.light.bg,
        theme_color: color.light.bg,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
      },
      // No service worker in dev: it would serve stale files while you work.
      devOptions: { enabled: false },
    }),
  ],
  server: { proxy },
  // `vite preview` serves the built app the same way (the e2e tests use it).
  preview: { proxy },
});
