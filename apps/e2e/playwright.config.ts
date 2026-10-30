import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, PASSWORD, WEB_ORIGIN, WEB_PORT } from './e2e-env.ts';

// A fresh database per run, in the OS temp folder; global-teardown.ts deletes it. The
// config is loaded again in each worker, so the first choice is kept in the environment.
process.env.E2E_DB_FILE ??= join(tmpdir(), `agenda-e2e-${randomUUID()}.db`);

const CI = process.env.CI !== undefined;

/**
 * The smoke test runs against the built apps: the API from apps/api/dist and the web app
 * served by `vite preview`, whose proxy forwards /api to this run's API. Run `pnpm build`
 * first.
 */
export default defineConfig({
  testDir: 'tests',
  // One user, one database: the tests share state, so they run in order.
  workers: 1,
  forbidOnly: CI,
  // No retries: the servers and database live for the whole run, so a retry would start
  // with the first attempt's events and fail for a different reason. A flaky step should
  // be fixed, not retried.
  retries: 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: WEB_ORIGIN,
    timezoneId: 'Asia/Karachi',
    locale: 'en-GB',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/start-api.ts',
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        E2E_PASSWORD: PASSWORD,
        E2E_DB_FILE: process.env.E2E_DB_FILE,
        E2E_API_PORT: String(API_PORT),
        E2E_WEB_ORIGIN: WEB_ORIGIN,
      },
    },
    {
      command: `pnpm --filter @agenda/web exec vite preview --port ${String(WEB_PORT)} --strictPort`,
      url: WEB_ORIGIN,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { AGENDA_API_URL: `http://localhost:${String(API_PORT)}` },
    },
  ],
});
