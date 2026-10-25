/**
 * Minimal structural types for fetch, so core needs neither the DOM nor Node type
 * libraries. The browser's fetch, React Native's, an extension service worker's, Tauri's
 * webview and Hono's `app.request` all fit them.
 */

export interface HeadersLike {
  get(name: string): string | null;
}

export interface ResponseLike {
  readonly status: number;
  readonly headers: HeadersLike;
  text(): Promise<string>;
}

export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

/** What the client passes to fetch. */
export interface RequestInitLike {
  method: string;
  headers: Record<string, string>;
  body?: string;
  credentials: 'include' | 'omit';
  signal: AbortSignalLike;
}

/**
 * The fetch the client calls. The init parameter is typed loosely on purpose: platform
 * fetch functions declare their own RequestInit (with DOM types core can't see), and a
 * method-style signature lets TypeScript accept them. The client always passes a full
 * RequestInitLike.
 */
export type FetchLike = {
  bivariantFetch(url: string, init: Record<string, unknown>): Promise<ResponseLike>;
}['bivariantFetch'];

interface AbortControllerLike {
  readonly signal: AbortSignalLike;
  abort(): void;
}

// Present in every runtime the client targets (browsers, Node, workers, React Native).
declare const AbortController: new () => AbortControllerLike;
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

export type AbortReason = 'timeout' | 'aborted';

/**
 * One signal that fires when the caller aborts or the timeout passes, whichever is
 * first, and remembers which. (AbortSignal.any isn't available on every platform.)
 */
export function abortAfter(timeoutMs: number, callerSignal?: AbortSignalLike) {
  const controller = new AbortController();
  let reason: AbortReason | undefined;
  const stop = (why: AbortReason) => {
    reason ??= why;
    controller.abort();
  };
  const onCallerAbort = () => {
    stop('aborted');
  };

  if (callerSignal?.aborted) stop('aborted');
  else callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    stop('timeout');
  }, timeoutMs);

  return {
    signal: controller.signal,
    /** Why the signal fired, or undefined if it hasn't. */
    reason: (): AbortReason | undefined => reason,
    /** Call when the request is finished, so the timer and listener don't linger. */
    done: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}
