import { createApiClient } from '@agenda/core';
import type { ApiClient } from '@agenda/core';
import { storageTokens } from './platform';

export type ExtensionApi = ApiClient<{
  kind: 'token';
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}>;

/**
 * The API client in token mode against the Server URL. Extension pages and the worker
 * may call any origin they hold a host permission for, so there is no CORS step and no
 * proxy. A 401 forgets the token; the pages and the worker then show "logged out".
 */
export function createExtensionApi(
  serverUrl: string,
  onUnauthorized = () => undefined,
): ExtensionApi {
  return createApiClient({
    baseUrl: serverUrl,
    auth: {
      kind: 'token',
      getToken: () => storageTokens.get(),
      onUnauthorized: () => {
        void storageTokens.clear();
        onUnauthorized();
      },
    },
  });
}
