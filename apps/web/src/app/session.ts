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

/** The desktop quick-add window's page: a popup, never sent to /login. */
export const QUICK_ADD_PATH = '/quick-add';

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
  const { pathname, search } = router.state.location;
  // The quick-add popup says "log in first" itself (a login page doesn't fit in it) and
  // stays on its page, so clearing would only refetch the session into another 401.
  if (pathname === QUICK_ADD_PATH) return;
  queryClient.clear();
  if (pathname === '/login') return;
  void router.navigate(loginPath(`${pathname}${search}`), { replace: true });
}
