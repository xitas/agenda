import { ApiError } from '@agenda/core';
import { QueryClient } from '@tanstack/react-query';

/** Retries network trouble once; never a 4xx (as in the web app). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}
