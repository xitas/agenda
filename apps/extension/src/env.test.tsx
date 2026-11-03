import { ApiError, NetworkError } from '@agenda/core';
import { render } from '@testing-library/react';
import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { browserEnv, pickLocale } from './env';
import { useExtension } from './ui/context';
import { createQueryClient } from './ui/queryClient';

describe('browserEnv', () => {
  it('reads the browser’s zone, language and clock', () => {
    expect(pickLocale('en-US')).toBe(enUS);
    expect(pickLocale('fr-FR')).toBe(enGB);
    expect(pickLocale(undefined)).toBe(enGB);
    const env = browserEnv();
    expect(env.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(Math.abs(env.now().getTime() - Date.now())).toBeLessThan(1_000);
  });
});

describe('createQueryClient', () => {
  it('retries network trouble once and never a 4xx', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      count: number,
      error: unknown,
    ) => boolean;
    expect(retry(0, new NetworkError('network', 'x'))).toBe(true);
    expect(retry(1, new NetworkError('network', 'x'))).toBe(false);
    expect(retry(0, new ApiError(500, 'internal', 'x'))).toBe(true);
    expect(retry(0, new ApiError(404, 'not_found', 'x'))).toBe(false);
  });
});

describe('useExtension', () => {
  it('needs the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Uses = () => {
      useExtension();
      return null;
    };
    expect(() => render(<Uses />)).toThrow('useExtension must be used inside <ExtensionProviders>');
  });
});
