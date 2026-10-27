import { ApiError } from '@agenda/core';
import { QueryClient } from '@tanstack/react-query';

/**
 * Retry network trouble and server errors a couple of times, but never a 4xx: asking
 * again won't make a missing event appear or a bad request valid.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
