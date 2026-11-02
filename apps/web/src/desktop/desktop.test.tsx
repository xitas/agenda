import {
  ApiError,
  deviceLabel,
  NetworkError,
  SHORTCUT_MESSAGES,
  SERVER_URL_MESSAGES,
  TRAY_SIGNED_OUT,
} from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/queryClient';
import { expectNoAxeViolations } from '../test-utils/axe';
import { SESSION, unauthorized } from '../test-utils/fakeApi';
import { fakeDesktop } from '../test-utils/fakeDesktop';
import { NOW, renderApp } from '../test-utils/renderApp';
import { DesktopSettingsDialog } from './DesktopSettingsDialog';

afterEach(() => {
  vi.unstubAllGlobals();
});

// 15:00 in Karachi on the test day (Tuesday 27 October 2026), with a 30-minute reminder.
const callAli: AgendaEvent = {
  id: '0190f5a2-0000-7000-8000-000000000001',
  title: 'Call Ali',
  notes: '',
  start: '2026-10-27T10:00:00.000Z',
  end: null,
  allDay: false,
  timezone: 'Asia/Karachi',
  location: null,
  color: 'blue',
  reminders: [30],
  rrule: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  deletedAt: null,
};

describe('the unreachable-server screen', () => {
  it('names the server, and Retry tries again', async () => {
    const app = renderApp('/', {
      setup: (fake) => {
        fake.auth.me.mockRejectedValueOnce(new NetworkError('network', 'down'));
      },
    });
    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', {
        name: `Can't reach Agenda at ${window.location.origin}`,
      }),
    ).toBeDefined();
    expect(alert.textContent).toContain('Is the API running? (pnpm dev)');
    // The browser has no Server URL to change.
    expect(screen.queryByRole('button', { name: 'Change server URL' })).toBeNull();
    await expectNoAxeViolations();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('textbox', { name: 'Quick add' })).toBeDefined();
    expect(app.auth.me).toHaveBeenCalledTimes(2);
  });

  it('shows the desktop app its Server URL, and a way to change it', async () => {
    const { platform } = fakeDesktop('main', { serverUrl: 'http://192.168.1.20:4001' });
    renderApp('/', {
      platform: { ...platform, apiBaseUrl: 'http://192.168.1.20:4001' },
      setup: (fake) => {
        fake.auth.me.mockRejectedValue(new ApiError(503, 'invalid_response', 'proxy'));
      },
    });
    expect(
      await screen.findByRole('heading', {
        name: "Can't reach Agenda at http://192.168.1.20:4001",
      }),
    ).toBeDefined();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Change server URL' }));
    expect(await screen.findByRole('dialog', { name: 'Desktop settings' })).toBeDefined();
    expect(await screen.findByRole('textbox', { name: 'Server URL' })).toHaveProperty(
      'value',
      'http://192.168.1.20:4001',
    );
  });

  it('keeps a plain message for other failures', async () => {
    renderApp('/', {
      setup: (fake) => {
        fake.auth.me.mockRejectedValue(new ApiError(500, 'internal', 'bug'));
      },
    });
    expect(
      await screen.findByText('Something went wrong loading your agenda. Try again.'),
    ).toBeDefined();
  });
});

describe('logging in on the desktop', () => {
  it('stores the token in the keychain and names the session after the app', async () => {
    const { platform } = fakeDesktop();
    const app = renderApp('/login', { platform });
    app.auth.login.mockResolvedValue({ token: 'new-token', session: SESSION });
    const user = userEvent.setup();
    expect(screen.getByText(/Server: http:\/\/localhost:4001/)).toBeDefined();
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/');
    });
    expect(app.auth.login).toHaveBeenCalledWith('secret', {
      label: deviceLabel(navigator.userAgent, 'Desktop app'),
    });
    expect(platform.auth.tokens.set).toHaveBeenCalledWith('new-token');
  });

  it('names the server it couldn’t reach, and can change it', async () => {
    const { platform } = fakeDesktop();
    const app = renderApp('/login', { platform });
    app.auth.login.mockRejectedValue(new NetworkError('network', 'down'));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(
      await screen.findByText(
        "Can't reach Agenda at http://localhost:4001. Is the API running? (pnpm dev)",
      ),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('dialog', { name: 'Desktop settings' })).toBeDefined();
  });

  it('forgets the token on logout', async () => {
    const { platform } = fakeDesktop();
    const app = renderApp('/', { platform });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/login');
    });
    expect(platform.auth.tokens.clear).toHaveBeenCalledOnce();
  });
});

function renderDialog(fake = fakeDesktop()) {
  const onReconnect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DesktopSettingsDialog
        desktop={fake.desktop}
        open
        onOpenChange={onOpenChange}
        onReconnect={onReconnect}
      />
    </QueryClientProvider>,
  );
  return { ...fake, onReconnect, onOpenChange, user: userEvent.setup() };
}

describe('DesktopSettingsDialog', () => {
  it('saves a new Server URL and reconnects', async () => {
    const { desktop, onReconnect, user } = renderDialog();
    const field = await screen.findByRole('textbox', { name: 'Server URL' });
    await user.clear(field);
    await user.type(field, 'api.example.com');
    await user.click(screen.getByRole('button', { name: 'Save and reconnect' }));
    expect(desktop.setServerUrl).toHaveBeenCalledWith('https://api.example.com');
    expect(onReconnect).toHaveBeenCalledOnce();
    await expectNoAxeViolations();
  });

  it('explains an address it can’t use, and doesn’t reconnect to the same one', async () => {
    const { desktop, onReconnect, user } = renderDialog();
    const field = await screen.findByRole('textbox', { name: 'Server URL' });
    await user.clear(field);
    await user.type(field, 'https://api.example.com/v1');
    await user.click(screen.getByRole('button', { name: 'Save and reconnect' }));
    expect(await screen.findByText(SERVER_URL_MESSAGES.path)).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');

    await user.clear(field);
    await user.type(field, 'localhost:4001/');
    await user.click(screen.getByRole('button', { name: 'Save and reconnect' }));
    expect(field).toHaveProperty('value', 'http://localhost:4001');
    expect(desktop.setServerUrl).not.toHaveBeenCalled();
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('shows what Rust says when it refuses the URL', async () => {
    const fake = fakeDesktop();
    fake.desktop.setServerUrl.mockRejectedValue("http://x isn't a server address.");
    const { user, onReconnect } = renderDialog(fake);
    const field = await screen.findByRole('textbox', { name: 'Server URL' });
    await user.clear(field);
    await user.type(field, 'http://x');
    await user.click(screen.getByRole('button', { name: 'Save and reconnect' }));
    expect(await screen.findByText("http://x isn't a server address.")).toBeDefined();
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('records a new shortcut from the next key press', async () => {
    const { desktop, user } = renderDialog();
    const shortcut = await screen.findByText(/Quick add from anywhere/);
    expect(shortcut.textContent).toBe('Quick add from anywhere: Ctrl + Shift + Space');
    const button = screen.getByRole('button', { name: 'Change shortcut' });
    await user.click(button);
    expect(button.textContent).toBe('Press the new shortcut… (Esc to cancel)');
    // Only a modifier so far: still listening.
    fireEvent.keyDown(button, { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    fireEvent.keyDown(button, { key: 'a', code: 'KeyA', altKey: true });
    await waitFor(() => {
      expect(desktop.setShortcut).toHaveBeenCalledWith('Alt+KeyA');
    });
    await waitFor(() => {
      expect(shortcut.textContent).toBe('Quick add from anywhere: Alt + A');
    });
    expect(button.textContent).toBe('Change shortcut');
  });

  it('says why a shortcut can’t be used, and Esc stops recording without closing', async () => {
    const fake = fakeDesktop();
    fake.desktop.setShortcut.mockRejectedValueOnce(
      'Alt+KeyQ is already used by another app. Try another.',
    );
    const { desktop, onOpenChange, user } = renderDialog(fake);
    const button = await screen.findByRole('button', { name: 'Change shortcut' });
    await user.click(button);
    fireEvent.keyDown(button, { key: 'a', code: 'KeyA' });
    expect(await screen.findByText(SHORTCUT_MESSAGES.needsModifier)).toBeDefined();
    fireEvent.keyDown(button, { key: 'q', code: 'KeyQ', altKey: true });
    expect(
      await screen.findByText('Alt+KeyQ is already used by another app. Try another.'),
    ).toBeDefined();

    await user.click(button);
    await user.keyboard('{Escape}');
    expect(button.textContent).toBe('Change shortcut');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(desktop.setShortcut).toHaveBeenCalledTimes(1);
  });

  it('turns launch at login on, and back off when that fails', async () => {
    const fake = fakeDesktop();
    const { desktop, user } = renderDialog(fake);
    const box = await screen.findByRole('checkbox', {
      name: 'Open Agenda in the tray when you log in',
    });
    await user.click(box);
    expect(desktop.setLaunchAtLogin).toHaveBeenCalledWith(true);
    expect(box).toHaveProperty('checked', true);

    desktop.setLaunchAtLogin.mockRejectedValueOnce(new Error('registry'));
    await user.click(box);
    expect(await screen.findByText('Something went wrong. Try again.')).toBeDefined();
    expect(box).toHaveProperty('checked', true);
  });
});

describe('Settings in the desktop app', () => {
  it('shows this computer instead of the install offer', async () => {
    const { platform } = fakeDesktop('main', { launchAtLogin: true });
    renderApp('/settings', { platform });
    const section = await screen.findByRole('region', { name: 'This computer' });
    expect(await within(section).findByText('http://localhost:4001')).toBeDefined();
    expect(within(section).getByText('Ctrl + Shift + Space')).toBeDefined();
    expect(within(section).getByText('On')).toBeDefined();
    await userEvent
      .setup()
      .click(within(section).getByRole('button', { name: 'Change desktop settings' }));
    expect(await screen.findByRole('dialog', { name: 'Desktop settings' })).toBeDefined();
  });
});

describe('DesktopSync', () => {
  it('sends the tray lines and reminders, and clears them on logout', async () => {
    const fake = fakeDesktop();
    const app = renderApp('/', {
      platform: fake.platform,
      setup: (api) => {
        api.events.listAll.mockResolvedValue([callAli]);
      },
    });
    await waitFor(() => {
      expect(fake.desktop.setTrayItems).toHaveBeenLastCalledWith([
        { label: 'Today, 15:00 · Call Ali', path: '/day/2026-10-27' },
      ]);
    });
    expect(fake.desktop.setReminders).toHaveBeenLastCalledWith([
      {
        key: `${callAli.id}:30:${callAli.start}`,
        atMs: Date.parse('2026-10-27T09:30:00.000Z'),
        title: 'Call Ali',
        body: 'Today, 15:00',
      },
    ]);
    // The range covers today and the next three days, refreshed in the background.
    const ends = app.events.listAll.mock.calls.map(([p]) => new Date(p?.to ?? 0).toISOString());
    expect(ends).toContain('2026-10-30T19:00:00.000Z');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => {
      expect(fake.desktop.setTrayItems).toHaveBeenLastCalledWith([{ label: TRAY_SIGNED_OUT }]);
    });
    expect(fake.desktop.setReminders).toHaveBeenLastCalledWith([]);
  });

  it('opens the day the tray asks for, and refetches when another window saved', async () => {
    const fake = fakeDesktop();
    const app = renderApp('/', { platform: fake.platform });
    await screen.findByRole('textbox', { name: 'Quick add' });
    await waitFor(() => {
      expect(fake.listeners.navigate.size).toBe(1);
    });
    act(() => {
      fake.emit('navigate', '/day/2026-10-28');
    });
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/day/2026-10-28');
    });
    const before = app.events.listAll.mock.calls.length;
    act(() => {
      fake.emit('eventsChanged');
    });
    await waitFor(() => {
      expect(app.events.listAll.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('is not part of the browser app', async () => {
    renderApp('/');
    expect(await screen.findByRole('textbox', { name: 'Quick add' })).toBeDefined();
  });
});

describe('the quick-add window', () => {
  it('adds on Enter, tells the main window, and hides', async () => {
    const fake = fakeDesktop('quick-add');
    const app = renderApp('/quick-add', { platform: fake.platform });
    app.events.create.mockImplementation((input) =>
      Promise.resolve({ ...callAli, ...input, id: input.id ?? callAli.id }),
    );
    const field = await screen.findByRole('textbox', { name: 'Quick add' });
    expect(document.activeElement).toBe(field);
    const user = userEvent.setup();
    await user.type(field, 'Call Ali tomorrow 3pm');
    // The live preview, under the field; Esc closes the window here.
    expect(screen.getByText('Call Ali')).toBeDefined();
    expect(screen.getByText('Enter to add · Esc to close')).toBeDefined();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(fake.desktop.hideQuickAdd).toHaveBeenCalled();
    });
    expect(app.events.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Call Ali', start: '2026-10-28T10:00:00.000Z' }),
    );
    expect(fake.desktop.eventsChanged).toHaveBeenCalledOnce();
    await expectNoAxeViolations();
  });

  it('keeps the text and says so when the save fails', async () => {
    const fake = fakeDesktop('quick-add');
    const app = renderApp('/quick-add', { platform: fake.platform });
    app.events.create.mockRejectedValue(new NetworkError('network', 'down'));
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Quick add' }), 'Lunch 1pm{Enter}');
    expect(
      await screen.findByText(`Couldn't reach the server, so "Lunch" wasn't added. Try again.`),
    ).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Quick add' })).toHaveProperty('value', 'Lunch 1pm');
    expect(fake.desktop.hideQuickAdd).not.toHaveBeenCalled();
  });

  it('closes on Esc, and starts empty and up to date each time it opens', async () => {
    const fake = fakeDesktop('quick-add');
    const app = renderApp('/quick-add', { platform: fake.platform });
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Quick add' }), 'Half-typed');
    await user.keyboard('{Escape}');
    expect(fake.desktop.hideQuickAdd).toHaveBeenCalled();
    act(() => {
      fake.emit('quickAddOpen');
    });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Quick add' })).toHaveProperty('value', '');
    });
    // Settings changed in the main window (theme, clock) are read again.
    await waitFor(() => {
      expect(app.settings.get).toHaveBeenCalledTimes(2);
    });
  });

  it('grows to fit what it shows', async () => {
    const observed: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observed.push(callback);
        }
        observe = () => undefined;
        disconnect = () => undefined;
      },
    );
    const fake = fakeDesktop('quick-add');
    renderApp('/quick-add', { platform: fake.platform });
    await screen.findByRole('textbox', { name: 'Quick add' });
    for (const callback of observed) callback();
    expect(fake.desktop.resizeQuickAdd).toHaveBeenCalled();
  });

  it('asks to log in in the main window when there is no session', async () => {
    const fake = fakeDesktop('quick-add');
    const app = renderApp('/quick-add', {
      platform: fake.platform,
      setup: (api) => {
        api.auth.me.mockRejectedValue(unauthorized());
      },
    });
    expect(await screen.findByText('Log in to Agenda to add events from here.')).toBeDefined();
    // The popup is never sent to /login.
    expect(app.router.state.location.pathname).toBe('/quick-add');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Agenda' }));
    expect(fake.desktop.showMain).toHaveBeenCalledWith('/login');
  });

  it('names the server when it can’t be reached', async () => {
    const fake = fakeDesktop('quick-add');
    renderApp('/quick-add', {
      platform: fake.platform,
      setup: (api) => {
        api.auth.me.mockRejectedValue(new NetworkError('network', 'down'));
      },
    });
    expect(
      await screen.findByText(
        "Can't reach Agenda at http://localhost:4001. Is the API running? (pnpm dev)",
      ),
    ).toBeDefined();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open Agenda' }));
    expect(fake.desktop.showMain).toHaveBeenCalledWith(undefined);
  });

  it('is only a way back to Today outside the desktop app', async () => {
    const app = renderApp('/quick-add');
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/');
    });
  });
});
