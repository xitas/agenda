import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { read } from '../storage';
import { expectNoAxeViolations } from '../test-utils/axe';
import type { ChromeExtras } from '../test-utils/chrome';
import { renderPage } from '../test-utils/render';
import { event, fakeServer, TOKEN } from '../test-utils/server';
import type { FakeServer } from '../test-utils/server';
import { Popup } from './Popup';

const extras = () => fakeBrowser as unknown as ChromeExtras;
let server: FakeServer;
let messages: unknown[];

beforeEach(() => {
  server = fakeServer();
  messages = [];
  fakeBrowser.runtime.onMessage.addListener((message) => {
    messages.push(message);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const quickAdd = () => screen.getByRole('textbox', { name: 'Quick add' });

describe('the popup', () => {
  it('logs in as "Chrome extension" and keeps the token in extension storage', async () => {
    const user = userEvent.setup();
    await renderPage(<Popup />, { token: null });
    expect(screen.getByText('Monday 2 November')).toBeDefined();
    await user.type(await screen.findByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('textbox', { name: 'Quick add' })).toBeDefined();
    expect(await read('token')).toBe(TOKEN);
    const login = server.requests.find((r) => r.url.endsWith('/auth/login'));
    expect(login?.url).toBe('http://localhost:4001/api/v1/auth/login');
  });

  it('says when the password is wrong', async () => {
    const user = userEvent.setup();
    await renderPage(<Popup />, { token: null });
    await user.type(await screen.findByLabelText(/Password/), 'nope');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText("That password didn't work. Try again.")).toBeDefined();
    expect(screen.getByText('Server: http://localhost:4001')).toBeDefined();
    await expectNoAxeViolations();
  });

  it("shows today's events, and adds with QuickAdd and its live preview", async () => {
    server.events = [
      event({
        title: 'Standup',
        start: '2026-11-02T04:00:00.000Z',
        end: '2026-11-02T04:15:00.000Z',
      }),
      event({ title: 'Holiday', allDay: true, start: '2026-11-02', end: '2026-11-03' }),
      event(),
    ];
    const user = userEvent.setup();
    await renderPage(<Popup />);
    const list = await screen.findByRole('list', { name: 'Events on 2026-11-02' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent.split('Category')[0]),
    ).toEqual(['HolidayAll day', 'Standup09:00 – 09:15', 'Dentist16:00 – 17:00']);

    await user.type(quickAdd(), 'Call Ali 3pm');
    expect(screen.getByText('Mon 2 Nov · 15:00')).toBeDefined();
    await user.keyboard('{Enter}');
    expect(await within(list).findByText('Call Ali')).toBeDefined();
    expect(server.events.at(-1)?.title).toBe('Call Ali');
    // The worker hears about it (badge, reminders).
    expect(messages).toContainEqual({ type: 'events-changed' });
    expect(quickAdd()).toHaveProperty('value', '');
    await expectNoAxeViolations();
  });

  it('gives the text back when the save fails', async () => {
    const user = userEvent.setup();
    await renderPage(<Popup />);
    await screen.findByText('Nothing today. Enjoy the space.');
    server.failWith = 'down';
    await user.type(quickAdd(), 'Lunch 1pm{Enter}');
    expect(
      await screen.findByText(`Couldn't reach the server, so "Lunch" wasn't added. Try again.`),
    ).toBeDefined();
    expect(quickAdd()).toHaveProperty('value', 'Lunch 1pm');
    server.failWith = 500;
    await user.clear(quickAdd());
    await user.type(quickAdd(), 'Gym{Enter}');
    expect(await screen.findByText(`Couldn't add "Gym". Try again.`)).toBeDefined();
    await user.keyboard('{Escape}');
    expect(quickAdd()).toHaveProperty('value', '');
  });

  it('shows "Can\'t reach Agenda" when the API is down, with a way to the Server URL', async () => {
    server.failWith = 'down';
    const user = userEvent.setup();
    await renderPage(<Popup />);
    expect(
      await screen.findByRole('heading', { name: "Can't reach Agenda at http://localhost:4001" }),
    ).toBeDefined();
    await expectNoAxeViolations();
    server.failWith = null;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('textbox', { name: 'Quick add' })).toBeDefined();
    server.failWith = 'down';
  });

  it('opens the settings from the "Can\'t reach" screen', async () => {
    server.failWith = 'down';
    const user = userEvent.setup();
    await renderPage(<Popup />);
    await user.click(await screen.findByRole('button', { name: 'Change server URL' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeDefined();
  });

  it('asks for access to a server it has no permission for', async () => {
    const user = userEvent.setup();
    await renderPage(<Popup />, { settings: { serverUrl: 'https://api.example.com' } });
    await user.click(await screen.findByRole('button', { name: 'Allow access' }));
    expect(extras().permissions.request).toHaveBeenCalledWith({
      origins: ['https://api.example.com/*'],
    });
    expect(await screen.findByRole('textbox', { name: 'Quick add' })).toBeDefined();
  });

  it('follows the theme set on the server', async () => {
    server.settings = { ...server.settings, theme: 'dark' };
    await renderPage(<Popup />);
    await screen.findByRole('textbox', { name: 'Quick add' });
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });

  it('opens the full app and the side panel', async () => {
    const openSidePanel = vi.fn();
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    const user = userEvent.setup();
    await renderPage(<Popup openSidePanel={openSidePanel} />, {
      settings: { webUrl: 'http://localhost:5173' },
    });
    await user.click(screen.getByRole('button', { name: 'Open this week in the side panel' }));
    expect(openSidePanel).toHaveBeenCalledOnce();
    const link = await screen.findByRole('link', { name: 'Open full Agenda →' });
    await waitFor(() => {
      expect(link.getAttribute('href')).toBe('http://localhost:5173');
    });
    await user.click(link);
    expect(create).toHaveBeenCalledWith({ url: 'http://localhost:5173' });
  });

  it('shows other failures plainly', async () => {
    server.failWith = 500;
    await renderPage(<Popup />);
    expect(
      await screen.findByText('Something went wrong loading your agenda. Try again.'),
    ).toBeDefined();
  });
});

describe('the popup settings', () => {
  async function openSettings(options = {}) {
    const onReconnect = vi.fn();
    const user = userEvent.setup();
    await renderPage(<Popup onReconnect={onReconnect} />, options);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    return { user, onReconnect };
  }

  it('saves a new server after Chrome allows it, logs out and reconnects', async () => {
    const { user, onReconnect } = await openSettings();
    const field = screen.getByRole('textbox', { name: 'Server URL' });
    await user.clear(field);
    await user.type(field, 'api.example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onReconnect).toHaveBeenCalledOnce();
    });
    expect(extras().permissions.request).toHaveBeenCalledWith({
      origins: ['https://api.example.com/*'],
    });
    expect((await read('settings')).serverUrl).toBe('https://api.example.com');
    expect(await read('token')).toBeNull();
    expect(messages).toContainEqual({ type: 'settings-changed' });
    await expectNoAxeViolations();
  });

  it('keeps the old server when Chrome says no, and checks the addresses', async () => {
    extras().permissions.answer = false;
    const { user, onReconnect } = await openSettings();
    const field = screen.getByRole('textbox', { name: 'Server URL' });
    await user.clear(field);
    await user.type(field, 'https://api.example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Agenda needs your permission to reach https://api.example.com.'),
    ).toBeDefined();
    expect(onReconnect).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, 'https://api.example.com/v1');
    const web = screen.getByRole('textbox', { name: 'Web app URL' });
    await user.clear(web);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(web.getAttribute('aria-invalid')).toBe('true');
    expect((await read('settings')).serverUrl).toBe('http://localhost:4001');
  });

  it('turns Chrome reminders on only with the notifications permission', async () => {
    const { user } = await openSettings();
    const box = screen.getByRole('checkbox', { name: 'Show reminders in Chrome' });
    expect(box).toHaveProperty('checked', false);
    await user.click(box);
    expect(extras().permissions.request).toHaveBeenCalledWith({ permissions: ['notifications'] });
    await waitFor(() => {
      expect(box).toHaveProperty('checked', true);
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('textbox', { name: 'Quick add' });
    expect((await read('settings')).remindersInChrome).toBe(true);
  });

  it('stays off when Chrome refuses notifications, and Cancel leaves', async () => {
    extras().permissions.answer = false;
    const { user } = await openSettings({ settings: { remindersInChrome: false } });
    const box = screen.getByRole('checkbox', { name: 'Show reminders in Chrome' });
    await user.click(box);
    expect(await screen.findByText('Chrome didn’t allow notifications.')).toBeDefined();
    expect(box).toHaveProperty('checked', false);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('textbox', { name: 'Quick add' })).toBeDefined();
  });

  it('turns reminders off without asking', async () => {
    const { user } = await openSettings({ settings: { remindersInChrome: true } });
    await user.click(screen.getByRole('checkbox', { name: 'Show reminders in Chrome' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('textbox', { name: 'Quick add' });
    expect((await read('settings')).remindersInChrome).toBe(false);
    expect(extras().permissions.request).not.toHaveBeenCalledWith({
      permissions: ['notifications'],
    });
  });
});
