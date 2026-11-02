import { isUnreachable } from '@agenda/core';
import { Button } from '@agenda/ui';
import { Navigate, Outlet, useLocation } from 'react-router';
import { loginPath } from '../app/session';
import { ServerUnreachable } from './ServerUnreachable';
import { isUnauthorized, useSession } from './session';

/** Shows the child routes only with a session; otherwise sends the user to /login. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <p className="splash" role="status">
        Loading your agenda…
      </p>
    );
  }
  if (session.isError) {
    if (isUnauthorized(session.error)) {
      return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
    }
    const retry = () => {
      void session.refetch();
    };
    if (isUnreachable(session.error)) {
      return <ServerUnreachable onRetry={retry} retrying={session.isFetching} />;
    }
    return (
      <div className="splash" role="alert">
        <p>Something went wrong loading your agenda. Try again.</p>
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }
  return <Outlet />;
}
