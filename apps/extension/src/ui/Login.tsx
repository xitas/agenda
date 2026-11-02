import { loginErrorMessage } from '@agenda/core';
import { Button, Input } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { SESSION_KEY, useExtension } from './context';

/** The session's name in Settings > Devices on the web app. */
export const SESSION_LABEL = 'Chrome extension';

/** Password only; the extension logs in as a token client. */
export function Login() {
  const { api, platform } = useExtension();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: async (value: string) => {
      const { token, session } = await api.auth.login(value, { label: SESSION_LABEL });
      // The worker sees the new token (storage.onChanged) and refreshes the badge.
      await platform.auth.tokens.set(token);
      return session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_KEY, session);
      void queryClient.invalidateQueries();
    },
  });

  return (
    <form
      className="ext-login"
      onSubmit={(event) => {
        event.preventDefault();
        login.mutate(password);
      }}
    >
      <h1 className="ext-login__title">Agenda</h1>
      <p className="ext-login__intro">Log in to see your agenda.</p>
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        // The only field in the popup; typing can start right away.
        autoFocus
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        {...(login.isError ? { error: loginErrorMessage(login.error, platform.apiBaseUrl) } : {})}
      />
      <Button type="submit" loading={login.isPending}>
        Log in
      </Button>
      <p className="ext-login__server">Server: {platform.apiBaseUrl}</p>
    </form>
  );
}
