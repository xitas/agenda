import type { QueryClient } from '@tanstack/react-query';

/**
 * Only same-site paths are allowed as the place to return to after logging in.
 * Anything else ("//evil.example", "https://…", "/\\evil") would turn the login link
 * into an open redirect, so it falls back to Today.
 */
export function safeNext(next: string | null | undefined): string {
  if (next === null || next === undefined) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next === '/login' || next.startsWith('/login?')) return '/';
  return next;
}

export function loginPath(next: string): string {
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}

interface Navigator {
  navigate: (to: string, options?: { replace?: boolean }) => unknown;
  state: { location: { pathname: string; search: string } };
}

/**
 * What a 401 means anywhere in the app: the session is gone. Forget everything cached
 * (it belonged to that session) and go to /login, remembering where the user was.
 */
export function handleUnauthorized(queryClient: QueryClient, router: Navigator): void {
  queryClient.clear();
  const { pathname, search } = router.state.location;
  if (pathname === '/login') return;
  void router.navigate(loginPath(`${pathname}${search}`), { replace: true });
}
