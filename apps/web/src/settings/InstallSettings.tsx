import { Button, useToast } from '@agenda/ui';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '../pwa/install';
import { SettingsSection } from './SettingsSection';

/** "Install Agenda", shown only while the browser offers to install it. */
export function InstallSettings() {
  const { canInstall, install } = useInstallPrompt();
  const { toast } = useToast();
  if (!canInstall) return null;
  return (
    <SettingsSection
      title="Install"
      description="Use Agenda in its own window, from your dock, start menu or home screen."
    >
      <div>
        <Button
          icon={<Download />}
          onClick={() => {
            void install().then((installed) => {
              if (installed) toast({ message: 'Agenda is installed.' });
            });
          }}
        >
          Install Agenda
        </Button>
      </div>
    </SettingsSection>
  );
}
