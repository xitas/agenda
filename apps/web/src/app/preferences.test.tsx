import { DEFAULT_SETTINGS } from '@agenda/core';
import type { Settings } from '@agenda/core';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { makeEvent } from '../test-utils/events';
import type { FakeApi } from '../test-utils/fakeApi';
import { renderApp } from '../test-utils/renderApp';
import { SETTINGS_STORAGE_KEY, cacheSettings, readCachedSettings } from './settings';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const SUNDAY_12H: Settings = { theme: 'system', weekStart: 'sunday', timeFormat: '12h' };
const withSettings = (settings: Settings) => (fake: FakeApi) => {
  fake.settings.get.mockResolvedValue(settings);
  fake.events.listAll.mockResolvedValue([
    makeEvent({
      title: 'Dentist',
      start: '2026-10-28T11:00:00.000Z',
      end: '2026-10-28T12:00:00.000Z',
    }),
  ]);
};
const THIN = String.fromCharCode(0x2009);

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('settings applied everywhere', () => {
  it('starts Week on Sunday and shows a 12-hour clock', async () => {
    renderApp('/week', { setup: withSettings(SUNDAY_12H) });
    expect(
      await screen.findByRole('heading', { level: 1, name: `25${THIN}–${THIN}31 Oct 2026` }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sunday, 25 October 2026' })).toBeDefined();
    expect(await screen.findByText('4:00 PM – 5:00 PM')).toBeDefined();
    expect(screen.getByText('8:00 AM')).toBeDefined();
  });

  it('starts Month and the sidebar calendar on Sunday', async () => {
    renderApp('/month', { setup: withSettings(SUNDAY_12H) });
    await screen.findByRole('heading', { level: 1, name: 'October 2026' });
    await waitFor(() => {
      expect(
        within(screen.getByRole('main'))
          .getAllByRole('button', { name: /, (no events|\d+ events?)$/ })[0]
          ?.getAttribute('aria-label'),
      ).toBe('Sunday, 27 September 2026, no events');
    });
    const calendar = screen.getByRole('complementary', { name: 'Calendar' });
    expect(within(calendar).getAllByRole('columnheader')[0]?.getAttribute('abbr')).toBe('Sunday');
    expect(await screen.findByText('4:00 PM')).toBeDefined();
  });

  it('uses the clock on Today and in the editor, whose calendar starts on Sunday too', async () => {
    renderApp('/', { setup: withSettings(SUNDAY_12H) });
    expect(await screen.findByText('Now · 2:00 PM')).toBeDefined();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New event' }));
    const editor = await screen.findByRole('dialog', { name: 'New event' });
    expect(within(editor).getByLabelText<HTMLInputElement>('Start time').value).toBe('2:00 PM');
    expect(within(editor).getByLabelText<HTMLInputElement>('End time').value).toBe('3:00 PM');
    await user.click(within(editor).getByRole('button', { name: /^Choose start date/ }));
    expect(within(editor).getAllByRole('columnheader')[0]?.getAttribute('abbr')).toBe('Sunday');
  });

  it('keeps the locale clock for "auto"', async () => {
    renderApp('/', { setup: withSettings(DEFAULT_SETTINGS) });
    expect(await screen.findByText('Now · 14:00')).toBeDefined();
  });

  it('applies the theme and keeps a local copy for the next first paint', async () => {
    const dark: Settings = { ...DEFAULT_SETTINGS, theme: 'dark', timeFormat: '24h' };
    renderApp('/', { setup: withSettings(dark) });
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(readCachedSettings()).toEqual(dark);
  });

  it('paints with the local copy before the server answers', async () => {
    cacheSettings(SUNDAY_12H);
    renderApp('/week', {
      setup: (fake) => {
        // The server never answers in this test.
        fake.settings.get.mockImplementation(() => new Promise(() => undefined));
      },
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: `25${THIN}–${THIN}31 Oct 2026` }),
    ).toBeDefined();
  });
});

describe('the local copy', () => {
  it('falls back to the defaults when missing, unreadable or unavailable', () => {
    expect(readCachedSettings({ getItem: () => null })).toEqual(DEFAULT_SETTINGS);
    expect(readCachedSettings({ getItem: () => '{nope' })).toEqual(DEFAULT_SETTINGS);
    expect(readCachedSettings({ getItem: () => '{"theme":"neon"}' })).toEqual(DEFAULT_SETTINGS);
    expect(readCachedSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(() => {
      cacheSettings(DEFAULT_SETTINGS, {
        setItem: () => {
          throw new Error('quota');
        },
      });
    }).not.toThrow();
    cacheSettings(SUNDAY_12H);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(SUNDAY_12H));
  });
});
