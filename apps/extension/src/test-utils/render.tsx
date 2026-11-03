import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createExtensionApi } from '../api';
import { createChromePlatform } from '../platform';
import { DEFAULT_EXTENSION_SETTINGS, write } from '../storage';
import type { ExtensionSettings } from '../storage';
import type { ChromePlatform } from '../ui/context';
import { ExtensionProviders } from '../ui/ExtensionProviders';
import { createQueryClient } from '../ui/queryClient';
import { TEST_ENV, TOKEN } from './server';

export interface RenderPageOptions {
  settings?: Partial<ExtensionSettings>;
  /** The stored token; null renders logged out. */
  token?: string | null;
}

/**
 * A page with the real platform adapter and API client: chrome.* is WXT's fake browser
 * and the API is test-utils/server.ts behind fetch.
 */
export async function renderPage(
  page: ReactNode,
  { settings = {}, token = TOKEN }: RenderPageOptions = {},
) {
  await write('settings', { ...DEFAULT_EXTENSION_SETTINGS, ...settings });
  await write('token', token);
  const platform = (await createChromePlatform()) as ChromePlatform;
  const api = createExtensionApi(platform.apiBaseUrl);
  const queryClient = createQueryClient();
  // Tests should fail fast instead of waiting for retries.
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } });
  const view = render(
    <ExtensionProviders value={{ api, platform, env: TEST_ENV }} queryClient={queryClient}>
      {page}
    </ExtensionProviders>,
  );
  return { ...view, platform, queryClient };
}
