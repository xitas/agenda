import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { NotificationAccessContext } from '../../src/notification-access';
import { ReminderSync } from '../../src/providers';
import type { NotificationAccess } from '../../src/reminders';
import { SessionGate } from '../../src/screens/session';
import { usePalette } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    // The tab bar passes its tint colors, which are strings.
    <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
  );

// The bottom tabs (DESIGN.md §4): Today · Calendar · Search · Settings, once logged in.
export default function TabsLayout() {
  const { color } = usePalette();
  const [access, setAccess] = useState<NotificationAccess | null>(null);
  return (
    <SessionGate>
      <NotificationAccessContext.Provider value={access}>
        <ReminderSync onAccess={setAccess} />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: color.accent,
            tabBarInactiveTintColor: color.textMuted,
            tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{ title: 'Today', tabBarIcon: icon('sunny-outline') }}
          />
          <Tabs.Screen
            name="calendar"
            options={{ title: 'Calendar', tabBarIcon: icon('calendar-outline') }}
          />
          <Tabs.Screen
            name="search"
            options={{ title: 'Search', tabBarIcon: icon('search-outline') }}
          />
          <Tabs.Screen
            name="settings"
            options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }}
          />
        </Tabs>
      </NotificationAccessContext.Provider>
    </SessionGate>
  );
}
