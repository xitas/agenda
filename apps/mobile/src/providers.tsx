import { ApiError, plainDateInTz } from '@agenda/core';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createMobileApi } from './api';
import { EditorProvider } from './components/EditorSheet';
import { SnackbarProvider } from './components/Snackbar';
import { AppContext, useApp } from './context';
import type { AppContextValue } from './context';
import { useDaysEvents, usePreferences } from './data';
import { deviceEnv } from './env';
import { prepareNotifications, rescheduleReminders, SCHEDULE_DAYS } from './reminders';
import type { NotificationAccess } from './reminders';
import { readServerUrl, saveServerUrl, secureTokens } from './storage';
import { PaletteContext, palette, schemeFor } from './theme';

/** Network trouble is retried once; a 4xx never (asking again won't change the answer). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}

/** Light or dark from the theme setting ("System" follows the phone). */
function Themed({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { preferences } = usePreferences();
  const value = useMemo(
    () => palette(schemeFor(preferences?.theme, system)),
    [preferences?.theme, system],
  );
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

/**
 * Keeps the phone's reminder alarms in step with the next two weeks of events: asks for
 * the notification permission once, then reschedules whenever the events change (each
 * time the app opens, after every edit here, and on every refresh).
 */
export function ReminderSync({
  onAccess,
  schedule = rescheduleReminders,
  prepare = prepareNotifications,
}: {
  onAccess?: (access: NotificationAccess) => void;
  schedule?: typeof rescheduleReminders;
  prepare?: typeof prepareNotifications;
}) {
  const { env } = useApp();
  const { hour12 } = usePreferences();
  const today = plainDateInTz(env.now(), env.timezone);
  const events = useDaysEvents(today, SCHEDULE_DAYS + 1);

  useEffect(() => {
    void prepare().then((result) => {
      onAccess?.(result);
    });
  }, [prepare, onAccess]);

  useEffect(() => {
    if (events.data === undefined) return;
    void schedule(events.data, {
      now: env.now(),
      timezone: env.timezone,
      locale: env.locale,
      hour12,
    });
  }, [events.data, env, hour12, schedule]);
  return null;
}

/**
 * Everything above the screens: gestures and safe areas, the query cache, the app
 * context (client, repository, server), the theme, the snackbar and the editor sheet.
 */
export function AppProviders({
  children,
  value,
  queryClient,
}: {
  children: ReactNode;
  /** Tests pass a ready context; the app builds it from storage. */
  value?: AppContextValue;
  queryClient?: QueryClient;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  const [serverUrl, setServerUrl] = useState<string | null>(value?.serverUrl ?? null);
  const env = useMemo(() => value?.env ?? deviceEnv(), [value]);

  useEffect(() => {
    if (serverUrl === null) void readServerUrl().then(setServerUrl);
  }, [serverUrl]);

  const changeServer = useCallback(
    async (url: string) => {
      await saveServerUrl(url);
      client.clear();
      setServerUrl(url);
    },
    [client],
  );

  const context = useMemo<AppContextValue | null>(() => {
    if (value !== undefined) return value;
    if (serverUrl === null) return null;
    const { api, events } = createMobileApi(serverUrl, secureTokens, () => {
      // The session is gone: forget what it showed; the gate shows the login screen.
      client.clear();
    });
    return { api, events, tokens: secureTokens, env, serverUrl, changeServer };
  }, [value, serverUrl, client, env, changeServer]);

  if (context === null) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <AppContext.Provider value={context}>
            <Themed>
              <BottomSheetModalProvider>
                <SnackbarProvider>
                  <EditorProvider>{children}</EditorProvider>
                </SnackbarProvider>
              </BottomSheetModalProvider>
            </Themed>
          </AppContext.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
