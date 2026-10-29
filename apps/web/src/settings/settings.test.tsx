import { ApiError, DEFAULT_SETTINGS, NetworkError } from '@agenda/core';
import type { SessionWithCurrent } from '@agenda/core';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test-utils/axe';
import { makeEvent } from '../test-utils/events';
import { renderApp } from '../test-utils/renderApp';

// NOW is Tuesday 27 October 2026, 14:00 in Karachi (UTC+5).
const path = (app: ReturnType<typeof renderApp>) => app.router.state.location.pathname;
const section = (name: string) => screen.findByRole('region', { name });

const THIS: SessionWithCurrent = {
  id: '0190f5a2-0000-7000-8000-0000000000aa',
  label: 'Chrome on Windows',
  createdAt: '2026-10-20T05:00:00.000Z',
  lastUsedAt: '2026-10-27T08:30:00.000Z',
  expiresAt: '2026-11-26T05:00:00.000Z',
  current: true,
};
const PHONE: SessionWithCurrent = {
  ...THIS,
  id: '0190f5a2-0000-7000-8000-0000000000bb',
  label: 'Safari on iOS',
  createdAt: '2026-10-26T13:00:00.000Z',
  lastUsedAt: '2026-10-26T18:15:00.000Z',
  current: false,
};

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('Settings', () => {
  it('is in the nav and has no axe violations', async () => {
    renderApp('/settings', {
      setup: (fake) => {
        fake.auth.sessions.mockResolvedValue([THIS, PHONE]);
      },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await screen.findByText('Safari on iOS');
    await expectNoAxeViolations();
  });

  it('opens from the account menu', async () => {
    const app = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    expect(path(app)).toBe('/settings');
  });
});

describe('Appearance', () => {
  it('shows the saved choices and saves a change at once, theme included', async () => {
    const app = renderApp('/settings');
    const appearance = await section('Appearance');
    expect(within(appearance).getByRole('radio', { name: 'Match the system' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(appearance).getByRole('radio', { name: 'Monday' })).toHaveProperty(
      'checked',
      true,
    );
    // en-GB's own clock is 24-hour.
    expect(within(appearance).getByRole('radio', { name: 'Automatic (16:30)' })).toHaveProperty(
      'checked',
      true,
    );
    expect(within(appearance).getByRole('radio', { name: '12-hour (4:30 PM)' })).toBeDefined();

    const user = userEvent.setup();
    await user.click(within(appearance).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(app.settings.update).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, theme: 'dark' });

    await user.click(within(appearance).getByRole('radio', { name: 'Sunday' }));
    await user.click(within(appearance).getByRole('radio', { name: '12-hour (4:30 PM)' }));
    expect(app.settings.update).toHaveBeenLastCalledWith({
      theme: 'dark',
      weekStart: 'sunday',
      timeFormat: '12h',
    });
    expect(within(appearance).getByRole('radio', { name: 'Sunday' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('rolls back and says so when the save fails', async () => {
    const app = renderApp('/settings');
    app.settings.update.mockRejectedValue(new NetworkError('network', 'offline'));
    const appearance = await section('Appearance');
    await userEvent.setup().click(within(appearance).getByRole('radio', { name: 'Light' }));
    expect(
      await screen.findByText("Couldn't save your settings. Check your connection and try again."),
    ).toBeDefined();
    await waitFor(() => {
      expect(within(appearance).getByRole('radio', { name: 'Match the system' })).toHaveProperty(
        'checked',
        true,
      );
    });
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('Data', () => {
  const v0 = [
    { id: 'a1', title: 'Gym', description: '', date: '2022-06-10T19:00:00.000Z' },
    { id: 'a2', title: 'Dentist', description: '', date: '2022-06-11T19:00:00.000Z' },
    { id: 'a3', title: '', description: '', date: 'not a date' },
  ];
  const file = (contents: string, name = 'AgendaData.json') =>
    new File([contents], name, { type: 'application/json' });

  it('imports a file and lists every skipped row with its reason', async () => {
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.events.importEvents.mockResolvedValue({
          imported: 1,
          skipped: [
            { index: 1, reason: 'Already exists' },
            { index: 2, reason: 'Invalid date' },
          ],
        });
      },
    });
    const data = await section('Data');
    await userEvent
      .setup()
      .upload(within(data).getByLabelText('Import from a file'), file(JSON.stringify(v0)));

    expect(await within(data).findByText('Imported 1 event. Skipped 2:')).toBeDefined();
    expect(
      within(data)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Row 2 "Dentist": Already exists', 'Row 3 "": Invalid date']);
    expect(app.events.importEvents).toHaveBeenCalledWith(v0, { tz: 'Asia/Karachi' });
  });

  it('reports a clean import, and files that are not JSON or not importable', async () => {
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.events.importEvents.mockResolvedValue({ imported: 3, skipped: [] });
      },
    });
    const data = await section('Data');
    const input = within(data).getByLabelText('Import from a file');
    const user = userEvent.setup();
    await user.upload(input, file('[{"no":"title"}]'));
    expect(await within(data).findByText('Imported 3 events.')).toBeDefined();

    await user.upload(input, file('this is not json'));
    expect(
      await within(data).findByText("That file isn't JSON. Choose an Agenda export (.json)."),
    ).toBeDefined();

    app.events.importEvents.mockRejectedValue(
      new ApiError(400, 'invalid_json', 'Expected an array of events'),
    );
    await user.upload(input, file('{}'));
    expect(
      await within(data).findByText("That file can't be imported: Expected an array of events."),
    ).toBeDefined();

    app.events.importEvents.mockRejectedValue(new NetworkError('network', 'offline'));
    await user.upload(input, file('[]'));
    expect(
      await within(data).findByText(
        "Couldn't reach the server, so we couldn't import the file. Try again.",
      ),
    ).toBeDefined();
  });

  it('exports JSON and .ics through the platform', async () => {
    const dentist = makeEvent({ title: 'Dentist', start: '2026-10-28T11:00:00.000Z' });
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.events.exportJson.mockResolvedValue([dentist]);
        fake.events.exportIcs.mockResolvedValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
      },
    });
    const data = await section('Data');
    const user = userEvent.setup();
    await user.click(within(data).getByRole('button', { name: 'Export as JSON' }));
    expect(await screen.findByText('Exported 1 event.')).toBeDefined();
    expect(app.saveFile).toHaveBeenCalledWith({
      name: 'agenda-2026-10-27.json',
      mimeType: 'application/json',
      contents: `${JSON.stringify([dentist], null, 2)}\n`,
    });

    await user.click(within(data).getByRole('button', { name: 'Export calendar (.ics)' }));
    expect(await screen.findByText('Exported your calendar.')).toBeDefined();
    expect(app.saveFile).toHaveBeenLastCalledWith({
      name: 'agenda-2026-10-27.ics',
      mimeType: 'text/calendar',
      contents: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    });
  });

  it('says nothing when a save is cancelled, and explains a failed export', async () => {
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.events.exportJson.mockResolvedValue([]);
        fake.events.exportIcs.mockResolvedValue('');
      },
    });
    const data = await section('Data');
    const user = userEvent.setup();
    app.saveFile.mockResolvedValue(false);
    await user.click(within(data).getByRole('button', { name: 'Export as JSON' }));
    await user.click(within(data).getByRole('button', { name: 'Export calendar (.ics)' }));
    await waitFor(() => {
      expect(app.saveFile).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(/^Exported/)).toBeNull();

    app.events.exportJson.mockRejectedValue(new ApiError(500, 'internal', 'Boom'));
    await user.click(within(data).getByRole('button', { name: 'Export as JSON' }));
    expect(await screen.findByText("Couldn't export your events. Try again.")).toBeDefined();
  });
});

describe('Devices', () => {
  it('lists sessions, marks this device, and logs another out', async () => {
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.auth.sessions.mockResolvedValueOnce([THIS, PHONE]).mockResolvedValue([THIS]);
        fake.auth.revokeSession.mockResolvedValue();
      },
    });
    const devices = await section('Devices');
    const rows = await within(devices).findAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Chrome on WindowsThis deviceSigned in Tue 20 Oct, 10:00 · last active Today, 13:30',
      'Safari on iOSSigned in Yesterday, 18:00 · last active Yesterday, 23:15Log out',
    ]);
    // Only other devices can be logged out from here.
    expect(rows[0]?.querySelector('button')).toBeNull();

    await userEvent.setup().click(
      within(devices).getByRole('button', {
        name: 'Log out Safari on iOS, signed in Yesterday, 18:00',
      }),
    );
    expect(app.auth.revokeSession).toHaveBeenCalledWith(PHONE.id);
    expect(await screen.findByText('Logged out Safari on iOS.')).toBeDefined();
    await waitFor(() => {
      expect(within(devices).queryByText('Safari on iOS')).toBeNull();
    });
    expect(within(devices).queryByRole('button', { name: 'Log out everywhere else' })).toBeNull();
  });

  it('logs out everywhere else', async () => {
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.auth.sessions
          .mockResolvedValueOnce([THIS, PHONE, { ...PHONE, id: 'x', label: 'Firefox on Linux' }])
          .mockResolvedValue([THIS]);
        fake.auth.revokeOtherSessions.mockResolvedValue(2);
      },
    });
    const devices = await section('Devices');
    await userEvent
      .setup()
      .click(await within(devices).findByRole('button', { name: 'Log out everywhere else' }));
    expect(app.auth.revokeOtherSessions).toHaveBeenCalledOnce();
    expect(await screen.findByText('Logged out 2 other devices.')).toBeDefined();
  });

  it('explains failures and offers a retry when the list fails', async () => {
    const app = renderApp('/settings', {
      setup: (fake) => {
        fake.auth.sessions.mockRejectedValueOnce(new NetworkError('network', 'offline'));
      },
    });
    const devices = await section('Devices');
    const alert = await within(devices).findByRole('alert');
    app.auth.sessions.mockResolvedValue([THIS, PHONE]);
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    await within(devices).findByText('Safari on iOS');

    const user = userEvent.setup();
    app.auth.revokeSession.mockRejectedValue(new ApiError(500, 'internal', 'Boom'));
    await user.click(within(devices).getByRole('button', { name: /^Log out Safari on iOS/ }));
    expect(await screen.findByText("Couldn't log out Safari on iOS. Try again.")).toBeDefined();

    app.auth.revokeOtherSessions.mockRejectedValue(new NetworkError('network', 'offline'));
    await user.click(within(devices).getByRole('button', { name: 'Log out everywhere else' }));
    expect(
      await screen.findByText(
        "Couldn't reach the server, so we couldn't log out the other devices. Try again.",
      ),
    ).toBeDefined();
  });

  it('says one device in the singular', async () => {
    renderApp('/settings', {
      setup: (fake) => {
        fake.auth.sessions.mockResolvedValue([THIS, PHONE]);
        fake.auth.revokeOtherSessions.mockResolvedValue(1);
      },
    });
    const devices = await section('Devices');
    await userEvent
      .setup()
      .click(await within(devices).findByRole('button', { name: 'Log out everywhere else' }));
    expect(await screen.findByText('Logged out 1 other device.')).toBeDefined();
  });
});

describe('Account', () => {
  it('logs out', async () => {
    const app = renderApp('/settings');
    const account = await section('Account');
    await userEvent.setup().click(within(account).getByRole('button', { name: 'Log out' }));
    await waitFor(() => {
      expect(path(app)).toBe('/login');
    });
    expect(app.auth.logout).toHaveBeenCalledOnce();
  });
});
