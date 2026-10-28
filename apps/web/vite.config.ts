import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev the browser only talks to Vite; /api is forwarded to the API. The app and
    // API are then same-origin, so the session cookie works without CORS. Builds use
    // VITE_API_URL instead.
    proxy: { '/api': 'http://localhost:4001' },
  },
});
