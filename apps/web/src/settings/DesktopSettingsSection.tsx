import { shortcutKeys } from '@agenda/core';
import type { DesktopBridge } from '@agenda/core';
import { Button } from '@agenda/ui';
import { useState } from 'react';
import { DesktopSettingsDialog } from '../desktop/DesktopSettingsDialog';
import { useDesktopSettings } from '../desktop/desktopSettings';
import { SettingsSection } from './SettingsSection';

/** Desktop only: which server this computer uses, its shortcut, launch at login. */
export function DesktopSettingsSection({ desktop }: { desktop: DesktopBridge }) {
  const settings = useDesktopSettings(desktop);
  const [open, setOpen] = useState(false);
  const data = settings.data;
  return (
    <SettingsSection
      title="This computer"
      description="Settings for the desktop app on this computer."
    >
      {data !== undefined && (
        <dl className="settings__facts">
          <div>
            <dt>Connected to</dt>
            <dd>{data.serverUrl}</dd>
          </div>
          <div>
            <dt>Quick add</dt>
            <dd>{shortcutKeys(data.shortcut).join(' + ')}</dd>
          </div>
          <div>
            <dt>Open at login</dt>
            <dd>{data.launchAtLogin ? 'On' : 'Off'}</dd>
          </div>
        </dl>
      )}
      <div>
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(true);
          }}
        >
          Change desktop settings
        </Button>
      </div>
      <DesktopSettingsDialog desktop={desktop} open={open} onOpenChange={setOpen} />
    </SettingsSection>
  );
}
