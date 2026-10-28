/// <reference types="node" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev the browser only talks to Vite; /api is forwarded to the API. The app and API
// are then same-origin, so the session cookie works without CORS. Builds use
// VITE_API_URL instead. AGENDA_API_URL moves the target, e.g. for the e2e run's own API.
const proxy = { '/api': process.env.AGENDA_API_URL ?? 'http://localhost:4001' };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  // `vite preview` serves the built app the same way (the e2e tests use it).
  preview: { proxy },
});
