import { createContext, useContext } from 'react';
import type { NotificationAccess } from './reminders';

/** Whether reminders can show, as Settings words it. */
export const NotificationAccessContext = createContext<NotificationAccess | null>(null);

export function useNotificationAccess(): string {
  const access = useContext(NotificationAccessContext);
  if (access === 'granted') return 'on';
  if (access === 'denied') return 'off (blocked in Android settings)';
  return 'not allowed yet';
}
