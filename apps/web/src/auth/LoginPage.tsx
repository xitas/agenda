import { Button, Input } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../app/api';
import { safeNext } from '../app/session';
import { loginErrorMessage } from './messages';
import { SESSION_KEY } from './session';

/** /login: one password field; after logging in, back to where the user was. */
export function LoginPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: (value: string) => api.auth.login(value, { label: 'web' }),
    onSuccess: ({ session }) => {
      queryClient.setQueryData(SESSION_KEY, session);
      void navigate(safeNext(params.get('next')), { replace: true });
    },
  });

  return (
    <main className="login">
      <form
        className="login__card"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate(password);
        }}
      >
        <h1 className="login__title">Agenda</h1>
        <p className="login__intro">Log in to see your agenda.</p>
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          // The only thing on the page; a keyboard user can start typing right away.
          autoFocus
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          {...(login.isError ? { error: loginErrorMessage(login.error) } : {})}
        />
        <Button type="submit" loading={login.isPending}>
          Log in
        </Button>
      </form>
    </main>
  );
}
