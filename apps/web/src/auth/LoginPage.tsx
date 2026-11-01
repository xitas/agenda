import { deviceLabel } from '@agenda/core';
import { Button, Input } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../app/api';
import { usePlatform } from '../app/platform';
import { safeNext } from '../app/session';
import { DesktopSettingsDialog } from '../desktop/DesktopSettingsDialog';
import { loginErrorMessage } from './messages';
import { SESSION_KEY } from './session';

/** /login: one password field; after logging in, back to where the user was. */
export function LoginPage() {
  const api = useApi();
  const platform = usePlatform();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { auth, desktop } = platform;

  const login = useMutation({
    mutationFn: async (value: string) => {
      // Name the session after this browser or app, so Settings > Devices can tell
      // them apart.
      const app = desktop === undefined ? undefined : 'Desktop app';
      const result = await api.auth.login(value, { label: deviceLabel(navigator.userAgent, app) });
      // A token client gets its token once, here; it goes straight to the keychain.
      if ('token' in result && auth.kind === 'token') await auth.tokens.set(result.token);
      return result;
    },
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
          {...(login.isError
            ? {
                error: loginErrorMessage(
                  login.error,
                  desktop === undefined ? undefined : platform.apiBaseUrl,
                ),
              }
            : {})}
        />
        <Button type="submit" loading={login.isPending}>
          Log in
        </Button>
        {desktop !== undefined && (
          <p className="login__server">
            Server: {platform.apiBaseUrl}{' '}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSettingsOpen(true);
              }}
            >
              Change
            </Button>
          </p>
        )}
      </form>
      {desktop !== undefined && (
        <DesktopSettingsDialog
          desktop={desktop}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </main>
  );
}
