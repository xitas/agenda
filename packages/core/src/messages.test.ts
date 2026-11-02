import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from './api-client.js';
import { loginErrorMessage, unreachableMessage, waitText } from './messages.js';

describe('waitText', () => {
  it.each([
    [1, '1 second'],
    [45, '45 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [900, '15 minutes'],
  ])('%i seconds -> "%s"', (seconds, text) => {
    expect(waitText(seconds)).toBe(text);
  });
});

describe('loginErrorMessage', () => {
  it('says what went wrong and what to do', () => {
    expect(loginErrorMessage(new NetworkError('network', 'x'))).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
    expect(loginErrorMessage(new ApiError(401, 'invalid_credentials', 'x'))).toBe(
      "That password didn't work. Try again.",
    );
    expect(loginErrorMessage(new ApiError(429, 'rate_limited', 'x'))).toBe(
      'Too many attempts. Try again later.',
    );
    expect(
      loginErrorMessage(
        new ApiError(429, 'rate_limited', 'x', undefined, { retryAfterSeconds: 840 }),
      ),
    ).toBe('Too many attempts. Try again in 14 minutes.');
    expect(loginErrorMessage(new ApiError(500, 'internal', 'x'))).toBe(
      'Something went wrong. Try again.',
    );
    expect(loginErrorMessage(new Error('?'))).toBe('Something went wrong. Try again.');
  });

  it('names the server it couldn’t reach when the app has one', () => {
    expect(loginErrorMessage(new NetworkError('network', 'x'), 'http://localhost:4001')).toBe(
      unreachableMessage('http://localhost:4001'),
    );
    expect(unreachableMessage('http://localhost:4001')).toBe(
      "Can't reach Agenda at http://localhost:4001. Is the API running? (pnpm dev)",
    );
  });
});
