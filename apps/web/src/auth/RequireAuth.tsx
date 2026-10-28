import { Button } from '@agenda/ui';
import { Navigate, Outlet, useLocation } from 'react-router';
import { loginPath } from '../app/session';
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
    return (
      <div className="splash" role="alert">
        <p>Couldn&apos;t reach the server. Check your connection and try again.</p>
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
  return <Outlet />;
}
