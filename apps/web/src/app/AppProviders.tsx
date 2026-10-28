import { ToastProvider } from '@agenda/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiProvider } from './ApiProvider';
import type { WebApi } from './api';
import { EnvProvider } from './EnvProvider';
import type { AppEnv } from './env';

export interface AppProvidersProps {
  api: WebApi;
  queryClient: QueryClient;
  env: AppEnv;
  children: ReactNode;
}

/** Everything a screen needs from above; tests use the same tree with fakes. */
export function AppProviders({ api, queryClient, env, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <EnvProvider env={env}>
          <ToastProvider>{children}</ToastProvider>
        </EnvProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
