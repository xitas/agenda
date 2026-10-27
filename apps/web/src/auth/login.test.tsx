import { ApiError, NetworkError } from '@agenda/core';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test-utils/renderApp';
import { SESSION, unauthorized } from '../test-utils/fakeApi';
import { loginErrorMessage, waitText } from './messages';

async function noAxeViolations() {
  const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function logIn(password = 'correct horse battery staple') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Password/), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  return user;
}

describe('/login', () => {
  it('logs in as a browser session and goes back to next', async () => {
    const app = renderApp('/login?next=%2Fplayground');
    app.auth.login.mockResolvedValue({ session: SESSION });
    await logIn();
    expect(app.auth.login).toHaveBeenCalledWith('correct horse battery staple', { label: 'web' });
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/playground');
    });
    expect(app.queryClient.getQueryData(['session'])).toEqual(SESSION);
  });

  it('ignores a next that points to another site', async () => {
    const app = renderApp('/login?next=%2F%2Fevil.example');
    app.auth.login.mockResolvedValue({ session: SESSION });
    await logIn();
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/');
    });
  });

  it('says when the password is wrong, and stays', async () => {
    const app = renderApp('/login');
    app.auth.login.mockRejectedValue(new ApiError(401, 'invalid_credentials', 'Wrong password'));
    await logIn('nope');
    expect(await screen.findByText("That password didn't work. Try again.")).toBeDefined();
    expect(screen.getByLabelText(/Password/).getAttribute('aria-invalid')).toBe('true');
    expect(app.router.state.location.pathname).toBe('/login');
    await noAxeViolations();
  });

  it('says when to try again after too many attempts', async () => {
    const app = renderApp('/login');
    app.auth.login.mockRejectedValue(
      new ApiError(429, 'rate_limited', 'Too many failed logins', undefined, {
        retryAfterSeconds: 840,
      }),
    );
    await logIn();
    expect(await screen.findByText('Too many attempts. Try again in 14 minutes.')).toBeDefined();
  });

  it('has a labelled password field, focused, and no axe violations', async () => {
    renderApp('/login');
    const field = await screen.findByLabelText(/Password/);
    expect(field.getAttribute('type')).toBe('password');
    expect(field.getAttribute('autocomplete')).toBe('current-password');
    expect(document.activeElement).toBe(field);
    await noAxeViolations();
  });
});

describe('login messages', () => {
  it.each([
    [1, '1 second'],
    [45, '45 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [900, '15 minutes'],
  ])('%i seconds -> "%s"', (seconds, text) => {
    expect(waitText(seconds)).toBe(text);
  });

  it('covers every kind of failure', () => {
    expect(loginErrorMessage(new NetworkError('network', 'x'))).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
    expect(loginErrorMessage(new ApiError(429, 'rate_limited', 'x'))).toBe(
      'Too many attempts. Try again later.',
    );
    expect(loginErrorMessage(new ApiError(500, 'internal', 'x'))).toBe(
      'Something went wrong. Try again.',
    );
    expect(loginErrorMessage(new Error('?'))).toBe('Something went wrong. Try again.');
  });
});

describe('RequireAuth', () => {
  it('sends a visitor without a session to /login, remembering where they were', async () => {
    const app = renderApp('/?view=1', {
      setup: ({ auth }) => {
        auth.me.mockRejectedValue(unauthorized());
      },
    });
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe('/login');
    });
    expect(app.router.state.location.search).toBe('?next=%2F%3Fview%3D1');
  });

  it('shows a loading message, then the page', async () => {
    const app = renderApp('/');
    expect(screen.getByRole('status').textContent).toBe('Loading your agenda…');
    expect(await screen.findByText('Agenda')).toBeDefined();
    expect(app.auth.me).toHaveBeenCalledOnce();
  });

  it('offers to try again when the server cannot be reached', async () => {
    const app = renderApp('/', {
      setup: ({ auth }) => {
        auth.me.mockRejectedValueOnce(new NetworkError('network', 'x'));
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Agenda')).toBeDefined();
    expect(app.auth.me).toHaveBeenCalledTimes(2);
  });
});
