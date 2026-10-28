import { ApiError } from '@agenda/core';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../app/api';

export const SESSION_KEY = ['session'] as const;

/** The current session; a 401 here means "not logged in" (the client redirects). */
export function useSession() {
  const api = useApi();
  return useQuery({ queryKey: SESSION_KEY, queryFn: () => api.auth.me() });
}

export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;
