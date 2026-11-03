import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import type { Worker } from '@playwright/test';
import { API_PORT, PASSWORD } from '../e2e-env.ts';

/** The built extension (`pnpm build` writes it). */
const EXTENSION = fileURLToPath(new URL('../../extension/.output/chrome-mv3', import.meta.url));
const API_ORIGIN = `http://localhost:${String(API_PORT)}`;

/** The badge as a number ("" is 0). */
async function badge(worker: Worker): Promise<number> {
  const text = await worker.evaluate<string>('chrome.action.getBadgeText({})');
  return text === '' ? 0 : Number(text);
}

/**
 * The extension in real Chromium against this run's API: log in through the popup, add
 * with QuickAdd, and see the toolbar badge count it. The API doesn't list the extension's
 * origin in CORS_ORIGINS; the host permission for localhost is what lets the calls through.
 */
test('extension: log in from the popup, add with QuickAdd, the badge counts it', async () => {
  // An extension needs its own browser profile; "chromium" runs it in new headless mode.
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;

    await test.step('point it at this run’s API', async () => {
      // The default is :4001; http://localhost/* is granted for every port.
      await worker.evaluate(
        `chrome.storage.local.set({ settings: { serverUrl: '${API_ORIGIN}', webUrl: 'http://localhost:5101', remindersInChrome: false } })`,
      );
    });

    const popup = await context.newPage();
    await test.step('log in through the popup', async () => {
      await popup.goto(`chrome-extension://${id}/popup.html`);
      await popup.getByLabel('Password').fill(PASSWORD);
      await popup.getByRole('button', { name: 'Log in' }).click();
      await expect(popup.getByRole('textbox', { name: 'Quick add' })).toBeVisible();
      // The worker saw the new token and fetched today's events for the badge.
      await expect
        .poll(() =>
          worker.evaluate<unknown>(
            "chrome.storage.local.get('cache').then((s) => s.cache ?? null)",
          ),
        )
        .not.toBeNull();
    });

    const before = await badge(worker);
    await test.step('add with QuickAdd and see the badge count it', async () => {
      const quickAdd = popup.getByRole('textbox', { name: 'Quick add' });
      // Starts in a minute and lasts an hour: still to come today, unless run at 23:59.
      await quickAdd.fill('Call Ali in 1 minute');
      await expect(popup.getByText('Call Ali').first()).toBeVisible();
      await quickAdd.press('Enter');
      await expect(popup.getByRole('list').getByText('Call Ali')).toBeVisible();
      await expect.poll(() => badge(worker)).toBe(before + 1);
    });

    await test.step('clean up: the specs share one database', async () => {
      const token = await worker.evaluate<string>(
        "chrome.storage.local.get('token').then((s) => s.token)",
      );
      const auth = { Authorization: `Bearer ${token}` };
      const found = (await (
        await fetch(`${API_ORIGIN}/api/v1/events?q=Call%20Ali`, { headers: auth })
      ).json()) as { events: { id: string }[] };
      for (const { id: eventId } of found.events) {
        const res = await fetch(`${API_ORIGIN}/api/v1/events/${eventId}`, {
          method: 'DELETE',
          headers: auth,
        });
        expect(res.status).toBe(204);
      }
    });
  } finally {
    await context.close();
  }
});
