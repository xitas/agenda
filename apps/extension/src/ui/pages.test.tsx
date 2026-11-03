import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { pendingKey, takePending } from '../storage';
import { expectNoAxeViolations } from '../test-utils/axe';
import { renderPage } from '../test-utils/render';
import { event, fakeServer } from '../test-utils/server';
import type { FakeServer } from '../test-utils/server';
import { ConfirmAdd } from './ConfirmAdd';
import { SidePanel } from './SidePanel';

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
});

describe('the side panel', () => {
  it('lists this week by day, today marked, with the same cards', async () => {
    server.events = [
      event({ title: 'Dentist' }),
      event({ title: 'Call Ali', start: '2026-11-06T10:00:00.000Z', end: null }),
      event({ title: 'Last week', start: '2026-10-30T10:00:00.000Z', end: null }),
      // 23:30 Thursday to 01:30 Friday in Karachi.
      event({
        title: 'Late flight',
        start: '2026-11-05T18:30:00.000Z',
        end: '2026-11-05T20:30:00.000Z',
      }),
    ];
    await renderPage(<SidePanel />);
    await screen.findByText('Dentist');
    expect(screen.getByRole('heading', { level: 1, name: 'Mon 2 Nov – Sun 8 Nov' })).toBeDefined();
    const days = screen.getAllByRole('region', { name: / Nov$/ });
    expect(days.map((day) => day.getAttribute('aria-label'))).toEqual([
      'Mon 2 Nov',
      'Tue 3 Nov',
      'Wed 4 Nov',
      'Thu 5 Nov',
      'Fri 6 Nov',
      'Sat 7 Nov',
      'Sun 8 Nov',
    ]);
    const day = (name: string) => within(screen.getByRole('region', { name }));
    expect(day('Mon 2 Nov').getByRole('heading').textContent).toBe('Today · Mon 2 Nov');
    expect(day('Mon 2 Nov').getByText('Dentist')).toBeDefined();
    expect(day('Fri 6 Nov').getByText('Call Ali')).toBeDefined();
    expect(day('Tue 3 Nov').getByText('Nothing planned.')).toBeDefined();
    expect(screen.queryByText('Last week')).toBeNull();
    // An overnight event shows what happens on each of its days.
    expect(day('Thu 5 Nov').getByText('23:30 →')).toBeDefined();
    expect(day('Fri 6 Nov').getByText('→ 01:30')).toBeDefined();
    await expectNoAxeViolations();
  });

  it('starts the week on Sunday when that is the setting', async () => {
    server.settings = { ...server.settings, weekStart: 'sunday' };
    await renderPage(<SidePanel />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sun 1 Nov – Sat 7 Nov' }),
    ).toBeDefined();
  });
});

describe('the confirm window (Add to Agenda)', () => {
  async function openWith(text: string) {
    const id = 'abc';
    await fakeBrowser.storage.session.set({ [pendingKey(id)]: text });
    const close = vi.fn();
    const view = await renderPage(<ConfirmAdd id={id} close={close} />);
    const field = await screen.findByRole('textbox', { name: 'Quick add' });
    return { ...view, close, field, user: userEvent.setup() };
  }

  it('shows what the selected text would create, and saves only on Add', async () => {
    const { close, field, user } = await openWith('Call Ali Friday 3pm');
    expect(field).toHaveProperty('value', 'Call Ali Friday 3pm');
    expect(screen.getByText('Fri 6 Nov · 15:00')).toBeDefined();
    expect(screen.getByText('Goes on Fri 6 Nov.')).toBeDefined();
    expect(server.events).toEqual([]);
    await expectNoAxeViolations();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(close).toHaveBeenCalledOnce();
    });
    expect(server.events.map((e) => [e.title, e.start])).toEqual([
      ['Call Ali', '2026-11-06T10:00:00.000Z'],
    ]);
    expect(messages).toContainEqual({ type: 'events-changed' });
  });

  it('lets the text be edited first, and Enter adds', async () => {
    const { close, field, user } = await openWith('see you at the dentist next tuesday 9am, ok?');
    await user.clear(field);
    await user.type(field, 'Dentist Tuesday 9am{Enter}');
    await waitFor(() => {
      expect(close).toHaveBeenCalled();
    });
    expect(server.events[0]?.title).toBe('Dentist');
  });

  it('closes without saving on Cancel or Esc', async () => {
    const { close, user } = await openWith('Call Ali Friday 3pm');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledTimes(2);
    expect(server.events).toEqual([]);
  });

  it('cannot add empty text, and says when saving fails', async () => {
    const { field, close, user } = await openWith('Lunch 1pm');
    await user.clear(field);
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
    await user.type(field, 'Lunch 1pm');
    server.failWith = 'down';
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(
      await screen.findByText(`Couldn't reach the server, so "Lunch" wasn't added. Try again.`),
    ).toBeDefined();
    server.failWith = 500;
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText(`Couldn't add "Lunch". Try again.`)).toBeDefined();
    expect(close).not.toHaveBeenCalled();
  });

  it('uses the selected text once', async () => {
    await fakeBrowser.storage.session.set({ [pendingKey('x')]: 'Gym 6pm' });
    expect(await takePending('x')).toBe('Gym 6pm');
    expect(await takePending('x')).toBe('');
  });

  it('asks to log in first when there is no session', async () => {
    await fakeBrowser.storage.session.set({ [pendingKey('abc')]: 'Gym 6pm' });
    await renderPage(<ConfirmAdd id="abc" close={vi.fn()} />, { token: null });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeDefined();
  });
});

describe('closing and retrying', () => {
  it('closes its own window by default', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    await fakeBrowser.storage.session.set({ [pendingKey('w')]: 'Gym 6pm' });
    await renderPage(<ConfirmAdd id="w" />);
    await screen.findByRole('textbox', { name: 'Quick add' });
    await userEvent.setup().keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });

  it('tries again after an unexpected error', async () => {
    server.failWith = 500;
    await renderPage(<SidePanel />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    server.failWith = null;
    await userEvent.setup().click(retry);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mon 2 Nov – Sun 8 Nov' }),
    ).toBeDefined();
  });
});
