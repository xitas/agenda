import { Button } from '@agenda/ui';
import { LogOut } from 'lucide-react';
import { useLogout } from '../auth/logout';
import { SettingsSection } from './SettingsSection';

export function AccountSettings() {
  const logout = useLogout();
  return (
    <SettingsSection title="Account" description="Log out of Agenda on this device.">
      <div>
        <Button
          variant="secondary"
          icon={<LogOut />}
          disabled={logout.isPending}
          onClick={() => {
            logout.mutate();
          }}
        >
          Log out
        </Button>
      </div>
    </SettingsSection>
  );
}
