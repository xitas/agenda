import { Button } from './Button.js';

export interface UnreachableCardProps {
  /** The server the app tried, e.g. "http://localhost:4001". */
  url: string;
  onRetry: () => void;
  retrying?: boolean;
  /** Where the app has a Server URL setting (desktop, extension): a link to change it. */
  onChangeServer?: () => void;
}

/**
 * "Can't reach Agenda at <url>" (DESIGN.md §4): shown instead of the app when the API
 * doesn't answer, with Retry and, where there is one, a way to change the server.
 */
export function UnreachableCard({
  url,
  onRetry,
  retrying = false,
  onChangeServer,
}: UnreachableCardProps) {
  return (
    <div className="ag-unreachable" role="alert">
      <h1 className="ag-unreachable__title">Can&apos;t reach Agenda at {url}</h1>
      <p className="ag-unreachable__hint">
        Is the API running? (<code>pnpm dev</code>)
      </p>
      <div className="ag-unreachable__actions">
        <Button onClick={onRetry} loading={retrying}>
          Retry
        </Button>
        {onChangeServer !== undefined && (
          <Button variant="ghost" onClick={onChangeServer}>
            Change server URL
          </Button>
        )}
      </div>
    </div>
  );
}
