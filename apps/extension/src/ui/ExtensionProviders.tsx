import { ToastProvider } from '@agenda/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ExtensionContext } from './context';
import { createQueryClient } from './queryClient';
import type { ExtensionContextValue } from './context';

/** Everything a page needs from above; tests use the same tree with fakes. */
export function ExtensionProviders({
  value,
  queryClient,
  children,
}: {
  value: ExtensionContextValue;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <ExtensionContext.Provider value={value}>
        <ToastProvider>{children}</ToastProvider>
      </ExtensionContext.Provider>
    </QueryClientProvider>
  );
}
