import { usesTwelveHour } from '@agenda/core';
import type { ExtensionBridge, Platform, Settings, TokenStore } from '@agenda/core';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { ExtensionApi } from '../api';
import type { ExtensionEnv } from '../env';

/** The extension platform: token auth and the extension bridge are always there. */
export type ChromePlatform = Platform & {
  auth: { kind: 'token'; tokens: TokenStore };
  extension: ExtensionBridge;
};

export interface ExtensionContextValue {
  api: ExtensionApi;
  platform: ChromePlatform;
  env: ExtensionEnv;
}

export const ExtensionContext = createContext<ExtensionContextValue | null>(null);

export function useExtension(): ExtensionContextValue {
  const value = useContext(ExtensionContext);
  if (value === null) throw new Error('useExtension must be used inside <ExtensionProviders>');
  return value;
}

export const SESSION_KEY = ['session'] as const;
export const PREFERENCES_KEY = ['settings'] as const;
export const EXTENSION_SETTINGS_KEY = ['extension-settings'] as const;

export function useSession() {
  const { api } = useExtension();
  return useQuery({ queryKey: SESSION_KEY, queryFn: () => api.auth.me() });
}

/** The server's shared preferences (theme, week start, clock), with the derived clock. */
export function usePreferences(): {
  preferences: Settings | undefined;
  hour12: boolean | undefined;
} {
  const { api, env } = useExtension();
  const query = useQuery({ queryKey: PREFERENCES_KEY, queryFn: () => api.settings.get() });
  return {
    preferences: query.data,
    hour12:
      query.data === undefined ? undefined : usesTwelveHour(query.data.timeFormat, env.locale.code),
  };
}

export function useExtensionSettings() {
  const { platform } = useExtension();
  return useQuery({
    queryKey: EXTENSION_SETTINGS_KEY,
    queryFn: () => platform.extension.settings(),
  });
}
