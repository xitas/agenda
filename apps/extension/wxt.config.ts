import { defineConfig } from 'wxt';

// The extension's manifest (MV3) is generated from this file and the entrypoints in
// src/entrypoints/. Every permission is listed with the reason it is needed; anything
// not listed (tabs, scripting, content scripts, <all_urls>) is deliberately absent.
export default defineConfig({
  srcDir: 'src',
  // Explicit imports (browser, defineBackground, ...), like the rest of the repo.
  imports: false,
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  // The toolbar, store and notification icons, generated from the app's one source icon.
  autoIcons: { baseIconPath: '../../web/public/icon.svg' },
  // `pnpm dev` opens Chrome with the extension loaded and hot reload.
  webExt: { startUrls: ['http://localhost:5173'] },
  // .output/agenda-chrome-0.1.0.zip: what CI uploads and the Web Store would take.
  zip: { artifactTemplate: 'agenda-chrome-{{version}}.zip' },
  manifest: {
    name: 'Agenda',
    description: 'Your agenda in Chrome: today at a glance, quick add, and Add to Agenda.',
    action: { default_title: 'Agenda' },
    permissions: [
      // The token, settings, cached events and shown reminders (the worker keeps nothing in memory).
      'storage',
      // Wakes the worker to refresh every 15 minutes and at badge and reminder times.
      'alarms',
      // "Add to Agenda" on selected text.
      'contextMenus',
      // The week view in Chrome's side panel.
      'sidePanel',
    ],
    optional_permissions: [
      // Asked for only when "Show reminders in Chrome" is turned on.
      'notifications',
    ],
    host_permissions: [
      // The default server, the API on this PC (Chrome's host patterns cover every port).
      'http://localhost/*',
    ],
    optional_host_permissions: [
      // Grants nothing at install: when the Server URL changes, only that origin is asked for.
      'http://*/*',
      'https://*/*',
    ],
    content_security_policy: {
      // Only the extension's own scripts; no plugins, no <base> tricks.
      extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none'",
    },
  },
});
