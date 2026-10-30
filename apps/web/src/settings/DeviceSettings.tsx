import { plainDateInTz } from '@agenda/core';
import type { SessionWithCurrent } from '@agenda/core';
import { Button, useToast } from '@agenda/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../app/api';
import { useEnv } from '../app/env';
import type { AppEnv } from '../app/env';
import { relativeDay, shortDate, timeOfDay, todayIn } from '../day/dayFormat';
import { failure } from '../events/mutations';
import { SettingsSection } from './SettingsSection';

const SESSIONS_KEY = ['sessions'] as const;

/** "Today, 14:05", "Yesterday, 09:30" or "Mon 26 Oct, 18:00", in the viewer's zone. */
function when(iso: string, env: AppEnv): string {
  const date = new Date(iso);
  const day = plainDateInTz(date, env.timezone);
  return `${relativeDay(day, todayIn(env)) ?? shortDate(day, env.locale.code)}, ${timeOfDay(date, env)}`;
}

/** Every device logged in to Agenda, with a way to log the others out. */
export function DeviceSettings() {
  const api = useApi();
  const env = useEnv();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessions = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: ({ signal }) => api.auth.sessions({ signal }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });

  const revoke = useMutation({
    mutationFn: (session: SessionWithCurrent) => api.auth.revokeSession(session.id),
    onSuccess: (_result, session) => {
      toast({ message: `Logged out ${session.label}.` });
    },
    onError: (error, session) => {
      toast({ message: failure(error, `log out ${session.label}`) });
    },
    onSettled: refresh,
  });

  const revokeOthers = useMutation({
    mutationFn: () => api.auth.revokeOtherSessions(),
    onSuccess: (count) => {
      toast({
        message: `Logged out ${String(count)} other ${count === 1 ? 'device' : 'devices'}.`,
      });
    },
    onError: (error) => {
      toast({ message: failure(error, 'log out the other devices') });
    },
    onSettled: refresh,
  });

  let body;
  if (sessions.isPending) {
    body = <p className="settings__status">Loading your devices…</p>;
  } else if (sessions.isError) {
    body = (
      <div className="settings__status" role="alert">
        <p>Couldn&apos;t load your devices. Check your connection and try again.</p>
        <Button
          variant="secondary"
          onClick={() => {
            void sessions.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else {
    const others = sessions.data.filter((session) => !session.current);
    body = (
      <>
        <ul className="settings__devices">
          {sessions.data.map((session) => (
            <li key={session.id} className="settings__device">
              <div className="settings__device-text">
                <p className="settings__device-name">
                  {session.label}
                  {session.current && <span className="settings__badge">This device</span>}
                </p>
                <p className="settings__device-meta">
                  Signed in {when(session.createdAt, env)} · last active{' '}
                  {when(session.lastUsedAt, env)}
                </p>
              </div>
              {!session.current && (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Log out ${session.label}, signed in ${when(session.createdAt, env)}`}
                  disabled={revoke.isPending || revokeOthers.isPending}
                  onClick={() => {
                    revoke.mutate(session);
                  }}
                >
                  Log out
                </Button>
              )}
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <div>
            <Button
              variant="danger"
              disabled={revokeOthers.isPending}
              onClick={() => {
                revokeOthers.mutate();
              }}
            >
              Log out everywhere else
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <SettingsSection
      title="Devices"
      description="Where you're logged in. Log out a device you no longer use or don't recognise."
    >
      {body}
    </SettingsSection>
  );
}
