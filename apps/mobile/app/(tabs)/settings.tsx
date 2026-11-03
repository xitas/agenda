import { Linking } from 'react-native';
import { useNotificationAccess } from '../../src/notification-access';
import { SettingsScreen } from '../../src/screens/tabs';

export default function Settings() {
  return (
    <SettingsScreen
      notifications={useNotificationAccess()}
      onOpenNotificationSettings={() => {
        void Linking.openSettings();
      }}
    />
  );
}
