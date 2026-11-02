import { useId } from 'react';
import { usePlatform } from '../app/platform';
import { AccountSettings } from './AccountSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { DesktopSettingsSection } from './DesktopSettingsSection';
import { DeviceSettings } from './DeviceSettings';
import { InstallSettings } from './InstallSettings';

/**
 * "/settings": appearance, data (import and export), devices and the account; in the
 * desktop app also this computer (server, shortcut, launch at login).
 */
export function SettingsPage() {
  const headingId = useId();
  const { desktop } = usePlatform();
  return (
    <section className="settings" aria-labelledby={headingId}>
      <h1 id={headingId} className="view-header__heading">
        Settings
      </h1>
      {desktop === undefined ? <InstallSettings /> : <DesktopSettingsSection desktop={desktop} />}
      <AppearanceSettings />
      <DataSettings />
      <DeviceSettings />
      <AccountSettings />
    </section>
  );
}
