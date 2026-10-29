import type { Platform } from '@agenda/core';
import { ToastProvider } from '@agenda/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiProvider } from './ApiProvider';
import type { WebApi } from './api';
import { EnvProvider } from './EnvProvider';
import type { AppEnv } from './env';
import { PlatformProvider } from './PlatformProvider';

export interface AppProvidersProps {
  api: WebApi;
  queryClient: QueryClient;
  env: AppEnv;
  /** What differs per platform (file saving now); the web app passes webPlatform. */
  platform: Platform;
  children: ReactNode;
}

/** Everything a screen needs from above; tests use the same tree with fakes. */
export function AppProviders({ api, queryClient, env, platform, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <EnvProvider env={env}>
          <PlatformProvider platform={platform}>
            <ToastProvider>{children}</ToastProvider>
          </PlatformProvider>
        </EnvProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
