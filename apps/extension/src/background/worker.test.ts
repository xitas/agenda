import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { pendingKey, read, write } from '../storage';
import type { ChromeExtras } from '../test-utils/chrome';
import { event, fakeServer, NOW, TEST_ENV, TOKEN } from '../test-utils/server';
import type { FakeServer } from '../test-utils/server';
import {
  ALARMS,
  MENU_ID,
  onAlarm,
  onMenuClick,
  refresh,
  REFRESH_MINUTES,
  setUp,
  showDueReminders,
} from './worker';

const extras = () => fakeBrowser as unknown as ChromeExtras;
const badge = () => fakeBrowser.action.getBadgeText({});
const alarm = (name: string) => fakeBrowser.alarms.get(name);
const at = (iso: string) => ({ ...TEST_ENV, now: () => new Date(iso) });

let server: FakeServer;
let notified: string[];

beforeEach(async () => {
  server = fakeServer();
  notified = [];
  vi.spyOn(fakeBrowser.notifications, 'create').mockImplementation(((id: string) => {
    notified.push(id);
    return Promise.resolve(id);
  }) as never);
  // The manifest WXT generates lists the icons; the fake browser has none.
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
    manifest_version: 3,
    name: 'Agenda',
    version: '0.1.0',
    icons: { 128: 'icons/128.png' },
  });
  await write('token', TOKEN);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('setUp (install and browser start)', () => {
  it('creates the menu, the 15-minute refresh and the badge', async () => {
    server.events = [
      event(),
      event({ start: '2026-11-02T03:00:00.000Z', end: '2026-11-02T04:00:00.000Z' }),
    ];
    await setUp(TEST_ENV);
    expect(extras().contextMenus.removeAll).toHaveBeenCalled();
    expect(extras().contextMenus.create).toHaveBeenCalledWith({
      id: MENU_ID,
      title: 'Add to Agenda',
      contexts: ['selection'],
    });
    expect((await alarm(ALARMS.refresh))?.periodInMinutes).toBe(REFRESH_MINUTES);
    // One event later today; the morning one has ended.
    expect(await badge()).toBe('1');
  });
});

describe('refresh', () => {
  it('fetches today and the next three days with the token, from the Server URL', async () => {
    await refresh(TEST_ENV);
    const list = server.requests.find((r) => r.url.includes('/events'));
    expect(list?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(list?.url).toBe(
      'http://localhost:4001/api/v1/events?from=2026-11-01T19%3A00%3A00.000Z&to=2026-11-05T19%3A00%3A00.000Z&tz=Asia%2FKarachi&limit=200',
    );
    expect((await read('cache'))?.fetchedAt).toBe(NOW.getTime());
  });

  it('wakes again when the badge next changes (the next event end)', async () => {
    server.events = [event({ end: '2026-11-02T12:00:00.000Z' })];
    await refresh(TEST_ENV);
    expect((await alarm(ALARMS.badge))?.scheduledTime).toBe(Date.parse('2026-11-02T12:00:00.000Z'));
    // When it fires, the badge is worked out again from storage, without the network.
    const requests = server.requests.length;
    await onAlarm(ALARMS.badge, at('2026-11-02T12:00:00.000Z'));
    expect(await badge()).toBe('');
    expect(server.requests.length).toBe(requests);
  });

  it('clears everything when logged out or the token is refused', async () => {
    server.events = [event()];
    await refresh(TEST_ENV);
    expect(await badge()).toBe('1');
    server.failWith = 401;
    await refresh(TEST_ENV);
    expect(await badge()).toBe('');
    expect(await read('token')).toBeNull();
    expect(await read('cache')).toBeNull();
    expect(await alarm(ALARMS.badge)).toBeUndefined();
  });

  it('keeps the last badge while the server is down', async () => {
    server.events = [event()];
    await refresh(TEST_ENV);
    server.failWith = 'down';
    await onAlarm(ALARMS.refresh, TEST_ENV);
    expect(await badge()).toBe('1');
  });

  it('picks up added and removed events on every refresh (a page message triggers one)', async () => {
    await refresh(TEST_ENV);
    server.events = [event(), event()];
    await refresh(TEST_ENV);
    expect(await badge()).toBe('2');
    server.events = [];
    await refresh(TEST_ENV);
    expect(await badge()).toBe('');
  });
});

describe('logged out', () => {
  it('shows no badge and fetches nothing without a token', async () => {
    await write('token', null);
    await refresh(TEST_ENV);
    expect(await badge()).toBe('');
    expect(server.requests).toEqual([]);
  });

  it('shows no badge when nothing has been fetched yet', async () => {
    await onAlarm(ALARMS.badge, TEST_ENV);
    expect(await badge()).toBe('');
    await onAlarm('unknown', TEST_ENV);
  });
});

describe('reminders', () => {
  // 16:00 in Karachi, reminders 30 minutes and 1 hour before.
  const dentist = () => event({ reminders: [30, 60] });

  it('schedules nothing while "Show reminders in Chrome" is off (the default)', async () => {
    server.events = [dentist()];
    await refresh(TEST_ENV);
    expect(await read('schedule')).toEqual([]);
    expect(await alarm(ALARMS.reminder)).toBeUndefined();
  });

  it('shows each reminder when due, once, and sets the alarm for the next', async () => {
    const settings = await read('settings');
    await write('settings', { ...settings, remindersInChrome: true });
    server.events = [dentist()];
    await refresh(TEST_ENV);
    const first = Date.parse('2026-11-02T10:00:00.000Z');
    expect((await alarm(ALARMS.reminder))?.scheduledTime).toBe(first);

    await onAlarm(ALARMS.reminder, at('2026-11-02T10:00:00.000Z'));
    expect(notified).toEqual([`${server.events[0]?.id ?? ''}:60:2026-11-02T11:00:00.000Z`]);
    expect(vi.mocked(fakeBrowser.notifications.create).mock.calls[0]?.[1]).toMatchObject({
      type: 'basic',
      iconUrl: 'icons/128.png',
      title: 'Dentist',
      message: 'Today, 16:00 – 17:00',
    });
    expect((await alarm(ALARMS.reminder))?.scheduledTime).toBe(
      Date.parse('2026-11-02T10:30:00.000Z'),
    );

    // The same alarm again (or a refresh in between) shows nothing twice.
    await onAlarm(ALARMS.reminder, at('2026-11-02T10:01:00.000Z'));
    await refresh(at('2026-11-02T10:02:00.000Z'));
    expect(notified).toHaveLength(1);
  });

  it('survives the worker being stopped: state comes back from storage', async () => {
    const settings = await read('settings');
    await write('settings', { ...settings, remindersInChrome: true });
    server.events = [dentist()];
    await setUp(TEST_ENV);
    await onAlarm(ALARMS.reminder, at('2026-11-02T10:00:00.000Z'));
    expect(notified).toHaveLength(1);

    // "Stop" in chrome://serviceworker-internals: the worker's memory is gone, storage
    // and alarms stay. A new worker module starts from nothing but storage.
    vi.resetModules();
    const fresh = await import('./worker');
    await fresh.onAlarm(ALARMS.reminder, at('2026-11-02T10:00:30.000Z'));
    expect(notified).toHaveLength(1);
    await fresh.onAlarm(ALARMS.reminder, at('2026-11-02T10:30:00.000Z'));
    expect(notified).toHaveLength(2);
    await fresh.onAlarm(ALARMS.badge, at('2026-11-02T10:30:00.000Z'));
    expect(await badge()).toBe('1');
  });

  it('skips a reminder more than 5 minutes late, and forgets old keys', async () => {
    await write('schedule', [
      { key: 'late', atMs: NOW.getTime() - 6 * 60_000, title: 'x', body: 'y' },
    ]);
    await write('shown', { ancient: NOW.getTime() - 3 * 24 * 60 * 60_000 });
    await showDueReminders(TEST_ENV);
    expect(notified).toEqual([]);
    await write('schedule', [{ key: 'now', atMs: NOW.getTime(), title: 'x', body: 'y' }]);
    await showDueReminders(TEST_ENV);
    expect(await read('shown')).toEqual({ now: NOW.getTime() });
  });

  it('still marks a reminder shown when the notifications permission was withdrawn', async () => {
    vi.mocked(fakeBrowser.notifications.create).mockRejectedValueOnce(new Error('no permission'));
    await write('schedule', [{ key: 'k', atMs: NOW.getTime(), title: 'x', body: 'y' }]);
    await showDueReminders(TEST_ENV);
    expect(await read('shown')).toEqual({ k: NOW.getTime() });
  });
});

describe('Add to Agenda (context menu)', () => {
  it('opens the confirm window with the selection, saving nothing', async () => {
    const create = vi.spyOn(fakeBrowser.windows, 'create');
    await onMenuClick({ menuItemId: MENU_ID, selectionText: '  Call Ali Friday 3pm  ' });
    const url = new URL(String(create.mock.calls[0]?.[0]?.url));
    expect(url.pathname).toBe('/confirm.html');
    expect(create.mock.calls[0]?.[0]).toMatchObject({ type: 'popup', width: 440, height: 340 });
    const id = url.searchParams.get('id') ?? '';
    const pending = await fakeBrowser.storage.session.get(pendingKey(id));
    expect(pending[pendingKey(id)]).toBe('Call Ali Friday 3pm');
    expect(server.requests.filter((r) => r.method === 'POST')).toEqual([]);
  });

  it('ignores other menus and empty selections', async () => {
    const create = vi.spyOn(fakeBrowser.windows, 'create');
    await onMenuClick({ menuItemId: 'other', selectionText: 'x' });
    await onMenuClick({ menuItemId: MENU_ID, selectionText: '   ' });
    await onMenuClick({ menuItemId: MENU_ID });
    expect(create).not.toHaveBeenCalled();
  });
});
