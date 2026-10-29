import { useId } from 'react';
import { AccountSettings } from './AccountSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { DeviceSettings } from './DeviceSettings';

/** "/settings": appearance, data (import and export), devices and the account. */
export function SettingsPage() {
  const headingId = useId();
  return (
    <section className="settings" aria-labelledby={headingId}>
      <h1 id={headingId} className="view-header__heading">
        Settings
      </h1>
      <AppearanceSettings />
      <DataSettings />
      <DeviceSettings />
      <AccountSettings />
    </section>
  );
}
