import { ApiError, isUnreachable } from '@agenda/core';
import { Button, UnreachableCard } from '@agenda/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useExtension, usePreferences, useSession } from './context';
import { Login } from './Login';

/** "system" follows the OS; light and dark win over it (tokens.css), as in the web app. */
function useTheme() {
  const { preferences } = usePreferences();
  const theme = preferences?.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === undefined || theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
}

function Themed({ children }: { children: ReactNode }) {
  useTheme();
  return children;
}

/**
 * What every page shows before its content: a way to grant access to the server if the
 * extension doesn't have it yet, the login form, or "Can't reach Agenda"; then the page.
 * `onChangeServer` opens the settings, where the page has them.
 */
export function SessionGate({
  children,
  onChangeServer,
}: {
  children: ReactNode;
  onChangeServer?: () => void;
}) {
  const { platform } = useExtension();
  const queryClient = useQueryClient();
  const access = useQuery({
    queryKey: ['server-access', platform.apiBaseUrl],
    queryFn: () => platform.extension.hasServerAccess(platform.apiBaseUrl),
  });
  const session = useSession();

  if (access.data === false) {
    return (
      <div className="ext-message" role="alert">
        <p>Agenda needs your permission to reach {platform.apiBaseUrl}.</p>
        <Button
          onClick={() => {
            // A click is a user gesture, so Chrome shows its permission prompt.
            void platform.extension.requestServerAccess(platform.apiBaseUrl).then(() => {
              void queryClient.invalidateQueries();
            });
          }}
        >
          Allow access
        </Button>
      </div>
    );
  }
  if (session.isPending || access.isPending) {
    return (
      <p className="ext-message" role="status">
        Loading your agenda…
      </p>
    );
  }
  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401) return <Login />;
    if (isUnreachable(session.error)) {
      return (
        <UnreachableCard
          url={platform.apiBaseUrl}
          onRetry={() => {
            void session.refetch();
          }}
          retrying={session.isFetching}
          {...(onChangeServer === undefined ? {} : { onChangeServer })}
        />
      );
    }
    return (
      <div className="ext-message" role="alert">
        <p>Something went wrong loading your agenda. Try again.</p>
        <Button
          variant="secondary"
          onClick={() => {
            void session.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  return <Themed>{children}</Themed>;
}
