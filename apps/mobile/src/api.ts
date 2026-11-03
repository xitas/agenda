import { createApiClient, createApiEventRepository } from '@agenda/core';
import type { ApiClient, EventRepository, TokenStore } from '@agenda/core';

export type MobileApi = ApiClient<{
  kind: 'token';
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}>;

/**
 * The API client in token mode against the Server URL, and the event repository on top
 * of it. A native app sends no Origin header, so CORS never applies; the bearer token
 * skips the API's CSRF check. A 401 forgets the token and shows the login screen.
 */
export function createMobileApi(
  serverUrl: string,
  tokens: TokenStore,
  onUnauthorized: () => void,
): { api: MobileApi; events: EventRepository } {
  const api = createApiClient({
    baseUrl: serverUrl,
    auth: {
      kind: 'token',
      getToken: () => tokens.get(),
      onUnauthorized: () => {
        void tokens.clear();
        onUnauthorized();
      },
    },
  });
  return { api, events: createApiEventRepository(api) };
}
