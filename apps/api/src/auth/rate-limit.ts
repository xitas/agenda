export interface RateLimitOptions {
  /** Failures allowed inside the window before further attempts are refused. */
  max: number;
  windowMs: number;
  now: () => Date;
  /** Upper bound on tracked keys, so a flood of IPs can't grow memory without limit. */
  maxKeys?: number;
}

export type RateLimitCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding-window failure counter kept in memory (one API process, so that's enough).
 * Only failures are recorded; a success clears the key.
 */
export function createRateLimiter({ max, windowMs, now, maxKeys = 10_000 }: RateLimitOptions) {
  const failures = new Map<string, number[]>();

  const recent = (key: string): number[] => {
    const cutoff = now().getTime() - windowMs;
    const kept = (failures.get(key) ?? []).filter((time) => time > cutoff);
    if (kept.length === 0) failures.delete(key);
    else failures.set(key, kept);
    return kept;
  };

  return {
    check(key: string): RateLimitCheck {
      const times = recent(key);
      const oldest = times[0];
      if (times.length < max || oldest === undefined) return { allowed: true };
      const retryAfterMs = oldest + windowMs - now().getTime();
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    },

    fail(key: string): void {
      const times = recent(key);
      times.push(now().getTime());
      failures.delete(key); // re-insert so Map order is "least recently failed first"
      failures.set(key, times);
      for (const oldestKey of failures.keys()) {
        if (failures.size <= maxKeys) break;
        failures.delete(oldestKey);
      }
    },

    reset(key: string): void {
      failures.delete(key);
    },

    /** Number of keys currently tracked (for tests and monitoring). */
    get size(): number {
      return failures.size;
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
