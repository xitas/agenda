import {
  addDaysToPlainDate,
  ApiError,
  badgeCount,
  badgeText,
  dayRangeInTz,
  dueReminders,
  nextBadgeChange,
  nextReminderAt,
  plainDateInTz,
  pruneShown,
  reminderSchedule,
  usesTwelveHour,
} from '@agenda/core';
import { color } from '@agenda/tokens';
import { browser } from 'wxt/browser';
import { createExtensionApi } from '../api';
import type { ExtensionEnv } from '../env';
import { pendingKey, read, readSettings, write } from '../storage';

/**
 * The service worker's work. MV3 stops the worker after about 30 seconds without events
 * and starts it again for the next one, so these functions keep nothing between calls:
 * each reads what it needs from chrome.storage and writes back what changed. Alarms and
 * the context menu are kept by Chrome itself.
 */

export const ALARMS = { refresh: 'refresh', badge: 'badge', reminder: 'reminder' } as const;
export const REFRESH_MINUTES = 15;
export const MENU_ID = 'add-to-agenda';
/** Today and the next three days: the badge needs today, reminders up to a day ahead. */
const DAYS = 4;

/** At install and at every browser start: Chrome may drop alarms when it restarts. */
export async function setUp(env: ExtensionEnv): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({ id: MENU_ID, title: 'Add to Agenda', contexts: ['selection'] });
  await browser.alarms.create(ALARMS.refresh, { periodInMinutes: REFRESH_MINUTES });
  await browser.action.setBadgeBackgroundColor({ color: color.light.accent });
  await refresh(env);
}

/** No session: nothing on the badge, nothing scheduled. */
async function signedOut(): Promise<void> {
  await write('cache', null);
  await write('schedule', []);
  await browser.action.setBadgeText({ text: '' });
  await browser.alarms.clear(ALARMS.badge);
  await browser.alarms.clear(ALARMS.reminder);
}

/** Fetches the next days' events, then updates the badge and reminders from them. */
export async function refresh(env: ExtensionEnv): Promise<void> {
  if ((await read('token')) === null) {
    await signedOut();
    return;
  }
  const { serverUrl } = await readSettings();
  const api = createExtensionApi(serverUrl);
  const now = env.now();
  const today = plainDateInTz(now, env.timezone);
  try {
    const [events, preferences] = await Promise.all([
      api.events.listAll({
        from: dayRangeInTz(today, env.timezone).start,
        to: dayRangeInTz(addDaysToPlainDate(today, DAYS - 1), env.timezone).end,
        tz: env.timezone,
      }),
      api.settings.get(),
    ]);
    await write('cache', { events, preferences, fetchedAt: now.getTime() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The client has already forgotten the token.
      await signedOut();
      return;
    }
    // Unreachable or failing: keep showing what was fetched last; the alarm tries again.
  }
  await update(env);
}

/** The badge and the reminder schedule from the cached events (no network). */
export async function update(env: ExtensionEnv): Promise<void> {
  const cache = await read('cache');
  if (cache === null) {
    await browser.action.setBadgeText({ text: '' });
    return;
  }
  const now = env.now();
  const options = { now, timezone: env.timezone };
  await browser.action.setBadgeText({ text: badgeText(badgeCount(cache.events, options)) });
  await browser.alarms.create(ALARMS.badge, {
    when: nextBadgeChange(cache.events, options).getTime(),
  });

  const settings = await readSettings();
  const hour12 = usesTwelveHour(cache.preferences?.timeFormat ?? 'auto', env.locale.code);
  const schedule = settings.remindersInChrome
    ? reminderSchedule(cache.events, { ...options, locale: env.locale, hour12 })
    : [];
  await write('schedule', schedule);
  await showDueReminders(env);
}

/**
 * Shows each reminder that is due and not shown before (core's rule, the same as the
 * desktop app's), remembers it, and sets the alarm for the next one.
 */
export async function showDueReminders(env: ExtensionEnv): Promise<void> {
  const nowMs = env.now().getTime();
  const schedule = await read('schedule');
  let shown = await read('shown');
  const due = dueReminders(schedule, shown, nowMs);
  for (const reminder of due) {
    try {
      await browser.notifications.create(reminder.key, {
        type: 'basic',
        // A path inside the extension: the 128 px icon WXT generated.
        iconUrl: browser.runtime.getManifest().icons?.[128] ?? '',
        title: reminder.title,
        message: reminder.body,
      });
    } catch {
      // The notifications permission was withdrawn; the reminder is still marked shown.
    }
    shown = { ...shown, [reminder.key]: reminder.atMs };
  }
  if (due.length > 0) await write('shown', pruneShown(shown, nowMs));

  const next = nextReminderAt(schedule, shown, nowMs);
  if (next === null) await browser.alarms.clear(ALARMS.reminder);
  else await browser.alarms.create(ALARMS.reminder, { when: next });
}

export async function onAlarm(name: string, env: ExtensionEnv): Promise<void> {
  if (name === ALARMS.refresh) await refresh(env);
  else if (name === ALARMS.badge) await update(env);
  else if (name === ALARMS.reminder) await showDueReminders(env);
}

/** The longest selection carried to the confirm window (a title is at most 200). */
const MAX_SELECTION = 500;

/**
 * "Add to Agenda" on selected text: opens the confirm window with it. Nothing is saved
 * here; the window shows what would be created and waits for Add.
 */
export async function onMenuClick(info: { menuItemId: string | number; selectionText?: string }) {
  const text = info.selectionText?.trim() ?? '';
  if (info.menuItemId !== MENU_ID || text === '') return;
  const id = crypto.randomUUID();
  // Session storage: kept in memory by Chrome, gone when the browser closes.
  await browser.storage.session.set({ [pendingKey(id)]: text.slice(0, MAX_SELECTION) });
  await browser.windows.create({
    url: `${browser.runtime.getURL('/confirm.html')}?id=${id}`,
    type: 'popup',
    width: 440,
    height: 340,
    focused: true,
  });
}
