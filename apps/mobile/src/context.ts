import type { EventRepository, TokenStore } from '@agenda/core';
import { createContext, useContext } from 'react';
import type { MobileApi } from './api';
import type { MobileEnv } from './env';

/** Everything a screen needs from above; tests provide the same with fakes. */
export interface AppContextValue {
  api: MobileApi;
  /** The only way screens read and write events (core's EventRepository). */
  events: EventRepository;
  tokens: TokenStore;
  env: MobileEnv;
  serverUrl: string;
  /** Saves a new Server URL; the app logs out and talks to the new server. */
  changeServer: (url: string) => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (value === null) throw new Error('useApp must be used inside <AppProviders>');
  return value;
}
