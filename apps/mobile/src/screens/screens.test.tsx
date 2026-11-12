import { ApiError, EVENT_FORM_MESSAGES, NetworkError } from '@agenda/core';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { SNACKBAR_MS } from '../components/Snackbar';
import { event, fakeBackend, NOW, renderScreen } from '../test-utils/render';
import { LoginScreen, SessionGate, SESSION_LABEL } from './session';
import { CalendarScreen, nextHour, SearchScreen, SettingsScreen, TodayScreen } from './tabs';

const quickAdd = () => screen.getByLabelText('Quick add');

describe('the session gate', () => {
  it('shows the screens once there is a session', async () => {
    await renderScreen(
      <SessionGate>
        <TodayScreen />
      </SessionGate>,
    );
    expect(await screen.findByLabelText('Quick add')).toBeTruthy();
  });

  it('logs in as "Android phone", keeps the token in the Keystore, and shows the server', async () => {
    const backend = fakeBackend();
    backend.api.auth.me.mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'Log in'));
    await renderScreen(
      <SessionGate>
        <TodayScreen />
      </SessionGate>,
      { backend },
    );
    expect(await screen.findByText('Server: http://192.168.1.20:4001')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByLabelText('Quick add')).toBeTruthy();
    expect(backend.api.auth.login).toHaveBeenCalledWith('secret', { label: SESSION_LABEL });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('agenda.token', 'a'.repeat(43));
  });

  it('names the server it couldn’t reach at login', async () => {
    const backend = fakeBackend();
    backend.api.auth.login.mockRejectedValueOnce(new NetworkError('network', 'down'));
    await renderScreen(<LoginScreen />, { backend });
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
    await fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    expect(
      await screen.findByText(
        "Can't reach Agenda at http://192.168.1.20:4001. Is the API running? (pnpm dev)",
      ),
    ).toBeTruthy();
  });

  it('shows "Can\'t reach Agenda", retries, and can change the Server URL', async () => {
    const backend = fakeBackend();
    backend.api.auth.me.mockRejectedValueOnce(new NetworkError('network', 'down'));
    const changeServer = jest.fn(() => Promise.resolve());
    await renderScreen(
      <SessionGate>
        <TodayScreen />
      </SessionGate>,
      { backend, changeServer },
    );
    expect(await screen.findByText("Can't reach Agenda at http://192.168.1.20:4001")).toBeTruthy();
    expect(screen.getByText('Is the API running? (pnpm dev)')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Change server URL' }));
    const field = screen.getByLabelText('Server URL');
    await fireEvent.changeText(field, 'http://api.example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    // Plain http:// only for local addresses (the cleartext rule).
    expect(
      await screen.findByText(
        'Use https:// for a server outside your network. Plain http:// is only for this device or your local network.',
      ),
    ).toBeTruthy();
    await fireEvent.changeText(field, '192.168.1.30:4001');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(changeServer).toHaveBeenCalledWith('http://192.168.1.30:4001');
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Quick add')).toBeTruthy();
  });

  it('keeps other failures plain, with Try again', async () => {
    const backend = fakeBackend();
    backend.api.auth.me.mockRejectedValueOnce(new ApiError(500, 'internal', 'bug'));
    await renderScreen(
      <SessionGate>
        <TodayScreen />
      </SessionGate>,
      { backend },
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Quick add')).toBeTruthy();
  });

  it('can change the server from the login screen, or cancel', async () => {
    const changeServer = jest.fn(() => Promise.reject(new Error('disk')));
    await renderScreen(<LoginScreen />, { changeServer });
    await fireEvent.press(screen.getByRole('button', { name: 'Change server' }));
    await fireEvent.changeText(screen.getByLabelText('Server URL'), '10.0.2.2:4001');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Couldn’t save the address. Try again.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });
});

describe('Today', () => {
  it('adds with QuickAdd after a live preview', async () => {
    const { backend } = await renderScreen(<TodayScreen />);
    expect(await screen.findByText('Nothing today. Enjoy the space.')).toBeTruthy();
    await fireEvent.changeText(quickAdd(), 'Lunch with Sara tomorrow 1pm');
    const preview = screen.getByTestId('quick-add-preview');
    expect(within(preview).getByText('Lunch with Sara')).toBeTruthy();
    expect(within(preview).getByText('Tue 3 Nov · 13:00')).toBeTruthy();
    await fireEvent(quickAdd(), 'submitEditing');
    await waitFor(() => {
      expect(backend.events.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Lunch with Sara', start: '2026-11-03T08:00:00.000Z' }),
      );
    });
    expect(await screen.findByText('Added “Lunch with Sara”.')).toBeTruthy();
    expect(quickAdd().props.value).toBe('');
  });

  it('gives the text back when the save fails', async () => {
    const backend = fakeBackend();
    backend.events.create.mockRejectedValueOnce(new NetworkError('network', 'down'));
    await renderScreen(<TodayScreen />, { backend });
    await fireEvent.changeText(quickAdd(), 'Gym 6pm');
    await fireEvent(quickAdd(), 'submitEditing');
    expect(
      await screen.findByText("Couldn't reach the server, so “Gym” wasn't added."),
    ).toBeTruthy();
    expect(quickAdd().props.value).toBe('Gym 6pm');
    backend.events.create.mockRejectedValueOnce(new ApiError(422, 'validation_failed', 'bad'));
    await fireEvent(quickAdd(), 'submitEditing');
    expect(await screen.findByText("Couldn't add “Gym”. Try again.")).toBeTruthy();
  });

  it('lists the day with the now marker, past events muted, all-day first', async () => {
    const backend = fakeBackend([
      event({
        title: 'Standup',
        start: '2026-11-02T04:00:00.000Z',
        end: '2026-11-02T04:15:00.000Z',
      }),
      event({ title: 'Dentist' }),
      event({ title: 'Holiday', allDay: true, start: '2026-11-02', end: '2026-11-03' }),
    ]);
    await renderScreen(<TodayScreen />, { backend });
    await screen.findByText('Dentist');
    const titles = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel as string)
      .filter((label) => /^(Standup|Dentist|Holiday),/.test(label));
    expect(titles.map((label) => label.split(',')[0])).toEqual(['Holiday', 'Standup', 'Dentist']);
    expect(screen.getByTestId('now-marker')).toBeTruthy();
    expect(screen.getByLabelText('Standup, 09:00 – 09:15, Category: Teal')).toBeTruthy();
  });

  it('deletes with a swipe (or the accessibility action) and brings it back with Undo', async () => {
    jest.useFakeTimers();
    const backend = fakeBackend([event({ title: 'Dentist' })]);
    await renderScreen(<TodayScreen />, { backend });
    const row = await screen.findByLabelText('Dentist, 16:00 – 17:00, Category: Teal');
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(await screen.findByText('Deleted “Dentist”.')).toBeTruthy();
    expect(backend.events.remove).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(backend.events.restore).toHaveBeenCalled();
    });
    expect(await screen.findByText('Dentist')).toBeTruthy();

    // A real swipe to the left opens the row, which deletes it too.
    await fireEvent(screen.getByTestId('swipeable'), 'swipeableOpen', 'right');
    expect(backend.events.remove).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId('swipeable'), 'swipeableOpen', 'left');
    expect(await screen.findByText('Deleted “Dentist”.')).toBeTruthy();
    expect(backend.events.remove).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));

    // The swipe's own Delete button does the same; the snackbar goes after a while.
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Dentist' }));
    expect(await screen.findByText('Deleted “Dentist”.')).toBeTruthy();
    await act(() => {
      jest.advanceTimersByTime(SNACKBAR_MS);
    });
    expect(screen.queryByText('Deleted “Dentist”.')).toBeNull();
    jest.useRealTimers();
  });

  it('says so when a delete fails', async () => {
    const backend = fakeBackend([event({ title: 'Dentist' })]);
    backend.events.remove.mockRejectedValueOnce(new NetworkError('network', 'down'));
    await renderScreen(<TodayScreen />, { backend });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Dentist' }));
    expect(await screen.findByText("Couldn't delete “Dentist”. Try again.")).toBeTruthy();
  });

  it('starts a new event at the next whole hour', () => {
    expect(nextHour(NOW).toISOString()).toBe('2026-11-02T06:00:00.000Z');
  });
});

describe('the editor sheet', () => {
  it('creates an event, validating like the web editor', async () => {
    const { backend } = await renderScreen(<TodayScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'New event' }));
    expect(await screen.findByRole('header', { name: 'New event' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Add a title')).toBeTruthy();
    expect(backend.events.create).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Call Ali');
    await fireEvent.press(screen.getByRole('radio', { name: 'Violet' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: '30 min before' }));
    await fireEvent.changeText(screen.getByLabelText('Location'), 'Office');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(backend.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Call Ali',
          color: 'violet',
          reminders: [30],
          location: 'Office',
          start: '2026-11-02T06:00:00.000Z',
        }),
      );
    });
  });

  it('edits with the native pickers, and says when the end is before the start', async () => {
    const dentist = event({ title: 'Dentist' });
    const { backend } = await renderScreen(<TodayScreen />, { backend: fakeBackend([dentist]) });
    await fireEvent.press(await screen.findByLabelText('Dentist, 16:00 – 17:00, Category: Teal'));
    expect(await screen.findByRole('header', { name: 'Edit event' })).toBeTruthy();
    const pick = async (label: string, value: Date) => {
      await fireEvent.press(screen.getByRole('button', { name: label }));
      const { onValueChange } =
        jest.mocked(DateTimePickerAndroid.open).mock.calls.at(-1)?.[0] ?? {};
      await act(() => {
        onValueChange?.({ nativeEvent: { timestamp: value.getTime(), utcOffset: 0 } }, value);
      });
    };
    await pick('End time, 17:00', new Date(2026, 10, 2, 15, 0));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(EVENT_FORM_MESSAGES.endBeforeStart)).toBeTruthy();

    await pick('End time, 15:00', new Date(2026, 10, 2, 18, 30));
    await pick('Start date, 2 Nov 2026', new Date(2026, 10, 2, 12, 0));
    // A dismissed picker changes nothing.
    await fireEvent.press(screen.getByRole('button', { name: 'Start time, 16:00' }));
    await act(() => {
      jest.mocked(DateTimePickerAndroid.open).mock.calls.at(-1)?.[0].onDismiss?.();
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(backend.events.update).toHaveBeenCalledWith(
        dentist.id,
        expect.objectContaining({ end: '2026-11-02T13:30:00.000Z' }),
      );
    });
  });

  it('deletes from the sheet with Undo, and switches to all day', async () => {
    const dentist = event({ title: 'Dentist' });
    const { backend } = await renderScreen(<TodayScreen />, { backend: fakeBackend([dentist]) });
    await fireEvent.press(await screen.findByLabelText('Dentist, 16:00 – 17:00, Category: Teal'));
    await fireEvent(screen.getByLabelText('All day'), 'valueChange', true);
    expect(screen.queryByRole('button', { name: 'Start time, 16:00' })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: '1 day before' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: '1 day before' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted “Dentist”.')).toBeTruthy();
    expect(backend.events.remove).toHaveBeenCalledWith(dentist.id);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  });
});

describe('Calendar', () => {
  it('shows the month and the chosen day’s events', async () => {
    const backend = fakeBackend([
      event({ title: 'Dentist' }),
      event({ title: 'Call Ali', start: '2026-11-06T10:00:00.000Z', end: null }),
      event({ title: 'Trip', allDay: true, start: '2026-11-05', end: '2026-11-08' }),
    ]);
    await renderScreen(<CalendarScreen />, { backend });
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(await screen.findByText('Dentist')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Friday 6 November, 2 events'));
    expect(await screen.findByText('Call Ali')).toBeTruthy();
    expect(screen.getByText('Trip')).toBeTruthy();
    expect(screen.queryByText('Dentist')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByText('December 2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(screen.getByLabelText('Monday 2 November, today, 1 event')).toBeTruthy();
  });
});

describe('Search', () => {
  it('finds events after a short pause, with their day', async () => {
    const backend = fakeBackend([
      event({ title: 'Dentist' }),
      event({ title: 'Dentist check-up', start: '2026-11-09T05:00:00.000Z', end: null }),
    ]);
    await renderScreen(<SearchScreen />, { backend });
    await fireEvent.changeText(screen.getByLabelText('Search events'), 'dentist');
    expect(await screen.findByText('Dentist check-up')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Mon 9 Nov')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Dentist check-up' }));
    expect(await screen.findByText('Deleted “Dentist check-up”.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dentist, 16:00 – 17:00, Category: Teal'));
    expect(await screen.findByRole('header', { name: 'Edit event' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search events'), 'nothing like it');
    expect(await screen.findByText('Nothing matches “nothing like it”.')).toBeTruthy();
  });
});

describe('Settings', () => {
  it('changes the shared preferences, lists devices, logs others out, and logs out', async () => {
    const backend = fakeBackend();
    const open = jest.fn();
    await renderScreen(
      <SettingsScreen notifications="not allowed yet" onOpenNotificationSettings={open} />,
      {
        backend,
      },
    );
    await fireEvent.press(await screen.findByRole('radio', { name: 'Dark' }));
    await waitFor(() => {
      expect(backend.api.settings.update).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Sunday' }));
    await fireEvent.press(screen.getByRole('radio', { name: '12-hour' }));
    await waitFor(() => {
      expect(backend.api.settings.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'dark', weekStart: 'sunday', timeFormat: '12h' }),
      );
    });

    expect(screen.getByText('Connected to http://192.168.1.20:4001')).toBeTruthy();
    expect(screen.getByText('Reminders: not allowed yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' }));
    expect(open).toHaveBeenCalled();

    expect(await screen.findByText('Android phone (this phone)')).toBeTruthy();
    expect(screen.getByText('Chrome on Windows')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Log out everywhere else' }));
    await waitFor(() => {
      expect(backend.api.auth.revokeOtherSessions).toHaveBeenCalled();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Change server URL' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => {
      expect(backend.api.auth.logout).toHaveBeenCalled();
    });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('agenda.token');
  });
});
