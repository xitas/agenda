import { ApiError, NetworkError } from '@agenda/core';
import { render } from '@testing-library/react';
import { enGB, enUS } from 'date-fns/locale';
import { describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, createWebApi, useApi } from './api';
import { browserEnv, pickLocale, useEnv } from './env';
import { createQueryClient, shouldRetry } from './queryClient';
import { renderApp } from '../test-utils/renderApp';
import { handleUnauthorized, loginPath, safeNext } from './session';

describe('safeNext', () => {
  it.each([
    ['/day/2026-10-28', '/day/2026-10-28'],
    ['/day/2026-10-28?x=1', '/day/2026-10-28?x=1'],
    [null, '/'],
    [undefined, '/'],
    ['', '/'],
    ['day/2026-10-28', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    ['/login', '/'],
    ['/login?next=/x', '/'],
  ])('%s -> %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});

describe('loginPath', () => {
  it('remembers where the user was, except Today', () => {
    expect(loginPath('/day/2026-10-28')).toBe('/login?next=%2Fday%2F2026-10-28');
    expect(loginPath('/')).toBe('/login');
  });
});

describe('handleUnauthorized', () => {
  const setup = (pathname: string, search = '') => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['session'], { id: 'x' });
    const router = { navigate: vi.fn(), state: { location: { pathname, search } } };
    handleUnauthorized(queryClient, router);
    return { queryClient, router };
  };

  it('clears the cache and goes to /login with next', () => {
    const { queryClient, router } = setup('/day/2026-10-28', '?a=1');
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
    expect(router.navigate).toHaveBeenCalledWith('/login?next=%2Fday%2F2026-10-28%3Fa%3D1', {
      replace: true,
    });
  });

  it('stays on /login', () => {
    expect(setup('/login').router.navigate).not.toHaveBeenCalled();
  });
});

describe('shouldRetry', () => {
  it('never retries client errors, retries others twice', () => {
    expect(shouldRetry(0, new ApiError(404, 'not_found', 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, 'unauthorized', 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(500, 'internal', 'x'))).toBe(true);
    expect(shouldRetry(1, new NetworkError('network', 'x'))).toBe(true);
    expect(shouldRetry(2, new NetworkError('network', 'x'))).toBe(false);
  });
});

describe('env and api', () => {
  it('picks en-US only for en-US', () => {
    expect(pickLocale('en-US')).toBe(enUS);
    expect(pickLocale('en-GB')).toBe(enGB);
    expect(pickLocale('ur-PK')).toBe(enGB);
    expect(pickLocale(undefined)).toBe(enGB);
  });

  it('reads the browser zone and clock', () => {
    const env = browserEnv();
    expect(env.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(Math.abs(env.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('uses VITE_API_URL only when set', () => {
    expect(apiBaseUrl({})).toBe('');
    expect(apiBaseUrl({ VITE_API_URL: 'https://api.agenda.example' })).toBe(
      'https://api.agenda.example',
    );
    expect('list' in createWebApi(() => undefined).events).toBe(true);
  });

  it('requires the providers', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const UsesApi = () => {
      useApi();
      return null;
    };
    const UsesEnv = () => {
      useEnv();
      return null;
    };
    expect(() => render(<UsesApi />)).toThrow('useApi must be used inside <ApiProvider>');
    expect(() => render(<UsesEnv />)).toThrow('useEnv must be used inside <EnvProvider>');
    vi.restoreAllMocks();
  });
});

describe('AppProviders', () => {
  it('gives every screen the api, env, query client and toasts', async () => {
    const { findByText } = renderApp('/');
    expect(await findByText('Agenda')).toBeDefined();
  });
});
