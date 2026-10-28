import { createApiClient } from '@agenda/core';
import type { ApiClient } from '@agenda/core';
import { createContext, useContext } from 'react';

/** The web app uses the session cookie (client: 'browser'). */
export interface CookieAuth {
  kind: 'cookie';
  onUnauthorized?: () => void;
}

export type WebApi = ApiClient<CookieAuth>;

/**
 * The API origin. Empty in dev: requests go to /api on the Vite server, which proxies
 * them to localhost:4001, so the app and API are same-origin and the cookie just works.
 */
export function apiBaseUrl(env: { VITE_API_URL?: string } = import.meta.env): string {
  return env.VITE_API_URL ?? '';
}

export function createWebApi(onUnauthorized: () => void): WebApi {
  return createApiClient({ baseUrl: apiBaseUrl(), auth: { kind: 'cookie', onUnauthorized } });
}

export const ApiContext = createContext<WebApi | null>(null);

export function useApi(): WebApi {
  const api = useContext(ApiContext);
  if (api === null) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
