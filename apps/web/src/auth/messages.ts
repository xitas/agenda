import { ApiError, NetworkError } from '@agenda/core';

/** "1 minute", "14 minutes", "45 seconds": when trying again will help. */
export function waitText(seconds: number): string {
  if (seconds < 60) return `${String(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/** What went wrong at login, and what to do about it (DESIGN.md §7). */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (error instanceof ApiError) {
    if (error.code === 'invalid_credentials') return "That password didn't work. Try again.";
    if (error.code === 'rate_limited') {
      return error.retryAfterSeconds === undefined
        ? 'Too many attempts. Try again later.'
        : `Too many attempts. Try again in ${waitText(error.retryAfterSeconds)}.`;
    }
  }
  return 'Something went wrong. Try again.';
}
