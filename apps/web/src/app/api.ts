import { createApiClient } from '@agenda/core';
import type { ApiClient, Platform } from '@agenda/core';
import { createContext, useContext } from 'react';

/** The client the app uses: cookie mode in the browser, token mode in the desktop app. */
export type WebApi = ApiClient;

/**
 * The browser's API origin. Empty in dev: requests go to /api on the Vite server, which
 * proxies them to localhost:4001, so the app and API are same-origin and the cookie just
 * works.
 */
export function apiBaseUrl(env: { VITE_API_URL?: string } = import.meta.env): string {
  return env.VITE_API_URL ?? '';
}

/**
 * The API client for this platform. In token mode a 401 also forgets the stored token:
 * it is no longer valid, so the next start goes straight to the login page.
 */
export function createAppApi(
  { auth, apiBaseUrl: baseUrl }: Pick<Platform, 'auth' | 'apiBaseUrl'>,
  onUnauthorized: () => void,
): WebApi {
  if (auth.kind === 'cookie') {
    return createApiClient({ baseUrl, auth: { kind: 'cookie', onUnauthorized } });
  }
  return createApiClient({
    baseUrl,
    auth: {
      kind: 'token',
      getToken: () => auth.tokens.get(),
      onUnauthorized: () => {
        void auth.tokens.clear();
        onUnauthorized();
      },
    },
  });
}

export const ApiContext = createContext<WebApi | null>(null);

export function useApi(): WebApi {
  const api = useContext(ApiContext);
  if (api === null) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
