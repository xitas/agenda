import { Button } from '@agenda/ui';
import { useState } from 'react';
import { usePlatform } from '../app/platform';
import { DesktopSettingsDialog } from '../desktop/DesktopSettingsDialog';
import { serverLabel } from './server';

/**
 * Shown instead of the app when the API can't be reached (nothing listens at the
 * address, or a proxy says so). The desktop app can also point itself somewhere else.
 */
export function ServerUnreachable({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const platform = usePlatform();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const url = serverLabel(platform);
  return (
    <main className="unreachable">
      <div className="unreachable__card" role="alert">
        <h1 className="unreachable__title">Can&apos;t reach Agenda at {url}</h1>
        <p className="unreachable__hint">
          Is the API running? (<code>pnpm dev</code>)
        </p>
        <div className="unreachable__actions">
          <Button onClick={onRetry} loading={retrying}>
            Retry
          </Button>
          {platform.desktop !== undefined && (
            <Button
              variant="ghost"
              onClick={() => {
                setSettingsOpen(true);
              }}
            >
              Change server URL
            </Button>
          )}
        </div>
      </div>
      {platform.desktop !== undefined && (
        <DesktopSettingsDialog
          desktop={platform.desktop}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </main>
  );
}
