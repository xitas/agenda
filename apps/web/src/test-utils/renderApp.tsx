import type { Platform } from '@agenda/core';
import { render } from '@testing-library/react';
import { enGB } from 'date-fns/locale';
import { createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from '../app/AppProviders';
import type { AppEnv } from '../app/env';
import { createQueryClient } from '../app/queryClient';
import { handleUnauthorized } from '../app/session';
import { routes } from '../router';
import { fakeApi } from './fakeApi';
import type { FakeApi } from './fakeApi';

/** Tuesday 27 October 2026, 14:00 in Karachi. */
export const NOW = new Date('2026-10-27T09:00:00.000Z');

export const TEST_ENV: AppEnv = {
  timezone: 'Asia/Karachi',
  locale: enGB,
  now: () => NOW,
  weekStart: 'monday',
  hour12: false,
};

export interface RenderAppOptions {
  env?: Partial<AppEnv>;
  /** Replaces the fake platform (its saveFile records files instead of downloading). */
  platform?: Platform;
  /** Runs before the first render, e.g. to make auth.me fail. */
  setup?: (fake: FakeApi) => void;
}

/**
 * The real routes and providers with a fake client, at `path`. The 401 handling is wired
 * exactly as in main.tsx.
 */
export function renderApp(path = '/', { env = {}, setup, platform }: RenderAppOptions = {}) {
  const saveFile = vi.fn<Platform['saveFile']>(() => Promise.resolve(true));
  const queryClient = createQueryClient();
  // Tests should fail fast instead of waiting for retries.
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } });
  const holder: { router?: ReturnType<typeof createMemoryRouter> } = {};
  const fake = fakeApi(() => {
    if (holder.router) handleUnauthorized(queryClient, holder.router);
  });
  setup?.(fake);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  holder.router = router;
  const view = render(
    <AppProviders
      api={fake.api}
      queryClient={queryClient}
      env={{ ...TEST_ENV, ...env }}
      platform={platform ?? { saveFile }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...fake, ...view, router, queryClient, saveFile };
}
