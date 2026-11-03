import { UnreachableCard } from '@agenda/ui';
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
  return (
    <main className="unreachable">
      <UnreachableCard
        url={serverLabel(platform)}
        onRetry={onRetry}
        retrying={retrying}
        {...(platform.desktop === undefined
          ? {}
          : {
              onChangeServer: () => {
                setSettingsOpen(true);
              },
            })}
      />
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
