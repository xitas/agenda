import { NetworkError } from '@agenda/core';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { enUS } from 'date-fns/locale';
import * as SecureStore from 'expo-secure-store';
import { Text } from 'react-native';
import { createMobileApi } from './api';
import { useApp } from './context';
import { deviceEnv, pickLocale } from './env';
import { useNotificationAccess } from './notification-access';
import { NotificationAccessContext } from './notification-access';
import { AppProviders, createQueryClient, ReminderSync } from './providers';
import { missingRuntimeFeatures } from './runtime-check';
import { DEFAULT_PHONE_SERVER_URL, readServerUrl, saveServerUrl, secureTokens } from './storage';
import { palette, schemeFor } from './theme';
import { event, fakeBackend, renderScreen, TEST_ENV } from './test-utils/render';

describe('storage', () => {
  it('keeps the token in the Keystore, and the server (logging out when it changes)', async () => {
    expect(await readServerUrl()).toBe(DEFAULT_PHONE_SERVER_URL);
    await secureTokens.set('t0ken');
    expect(await secureTokens.get()).toBe('t0ken');
    await saveServerUrl('http://192.168.1.20:4001');
    expect(await readServerUrl()).toBe('http://192.168.1.20:4001');
    expect(await secureTokens.get()).toBeNull();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'agenda.serverUrl',
      'http://192.168.1.20:4001',
    );
  });
});

describe('createMobileApi', () => {
  it('sends the token to the Server URL and forgets it on a 401', async () => {
    const fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Log in' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(fetch);
    await secureTokens.set('a'.repeat(43));
    const onUnauthorized = jest.fn();
    const { api, events } = createMobileApi(
      'http://192.168.1.20:4001',
      secureTokens,
      onUnauthorized,
    );
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://192.168.1.20:4001/api/v1/auth/me');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${'a'.repeat(43)}`);
    expect(onUnauthorized).toHaveBeenCalled();
    await waitFor(async () => {
      expect(await secureTokens.get()).toBeNull();
    });
    expect(typeof events.listRange).toBe('function');
    spy.mockRestore();
  });
});

describe('env and theme', () => {
  it('reads the phone’s zone and language', () => {
    expect(pickLocale('en-US')).toBe(enUS);
    expect(pickLocale('ur-PK').code).toBe('en-GB');
    const env = deviceEnv();
    expect(env.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(Math.abs(env.now().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it('draws light or dark from the setting, "system" following the phone', () => {
    expect(schemeFor('dark', 'light')).toBe('dark');
    expect(schemeFor('light', 'dark')).toBe('light');
    expect(schemeFor('system', 'dark')).toBe('dark');
    expect(schemeFor(undefined, null)).toBe('light');
    expect(palette('dark').event('teal').strong).toBe('#2DD4BF');
  });

  it('words the notification permission for Settings', async () => {
    const Show = () => <Text>{useNotificationAccess()}</Text>;
    for (const [access, words] of [
      ['granted', 'on'],
      ['denied', 'off (blocked in Android settings)'],
      [null, 'not allowed yet'],
    ] as const) {
      await render(
        <NotificationAccessContext.Provider value={access}>
          <Show />
        </NotificationAccessContext.Provider>,
      );
      expect(screen.getByText(words)).toBeTruthy();
    }
  });
});

describe('missingRuntimeFeatures', () => {
  it('finds nothing missing where Intl, crypto and URL are complete (Node)', () => {
    expect(missingRuntimeFeatures()).toEqual([]);
  });

  it('names what is missing', () => {
    const bare = {
      Intl: {
        DateTimeFormat: function () {
          throw new RangeError('no time zones');
        },
      },
      URL: function () {
        return { origin: 'null', pathname: '', protocol: 'http:' };
      },
    } as unknown as typeof globalThis;
    expect(missingRuntimeFeatures(bare)).toEqual([
      'Intl time zones (longOffset)',
      'crypto.getRandomValues',
      'URL',
    ]);
    const wrongOffset = {
      ...globalThis,
      Intl: {
        DateTimeFormat: function () {
          return { format: () => 'GMT' };
        },
      },
      URL: function () {
        throw new TypeError('no URL');
      },
    } as unknown as typeof globalThis;
    expect(missingRuntimeFeatures(wrongOffset)).toEqual(['Intl time zones (longOffset)', 'URL']);
  });
});

describe('ReminderSync', () => {
  it('asks for permission once, and reschedules when the events arrive', async () => {
    const schedule = jest.fn(() => Promise.resolve([]));
    const prepare = jest.fn(() => Promise.resolve('granted' as const));
    const onAccess = jest.fn();
    const backend = fakeBackend([event({ reminders: [30] })]);
    await renderScreen(<ReminderSync schedule={schedule} prepare={prepare} onAccess={onAccess} />, {
      backend,
    });
    await waitFor(() => {
      expect(schedule).toHaveBeenCalled();
    });
    expect(onAccess).toHaveBeenCalledWith('granted');
    expect(schedule.mock.calls[0]).toEqual([
      [expect.objectContaining({ title: 'Dentist' })],
      expect.objectContaining({ timezone: TEST_ENV.timezone, hour12: false }),
    ]);
    // Fifteen days from today: two weeks of reminders plus today.
    expect(backend.events.listRange).toHaveBeenCalledWith(
      expect.objectContaining({ end: new Date('2026-11-16T19:00:00.000Z') }),
      TEST_ENV.timezone,
      expect.anything(),
    );
  });
});

describe('AppProviders', () => {
  it('builds the client from the stored Server URL, and a new server clears the cache', async () => {
    await saveServerUrl('http://192.168.1.20:4001');
    const fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(fetch);
    let change: ((url: string) => Promise<void>) | undefined;
    const Probe = () => {
      const app = useApp();
      change = app.changeServer;
      return <Text>{app.serverUrl}</Text>;
    };
    await render(
      <AppProviders queryClient={createQueryClient()}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('http://192.168.1.20:4001')).toBeTruthy();
    // Saving the address and switching to it re-renders the providers: inside act(...).
    await act(() => change?.('http://10.0.2.2:4001'));
    expect(await screen.findByText('http://10.0.2.2:4001')).toBeTruthy();
    expect(await readServerUrl()).toBe('http://10.0.2.2:4001');
    spy.mockRestore();
    expect(new NetworkError('network', 'x').kind).toBe('network');
  });

  it('needs to be inside the providers', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const Uses = () => {
      useApp();
      return null;
    };
    await expect(render(<Uses />)).rejects.toThrow('useApp must be used inside <AppProviders>');
  });
});
