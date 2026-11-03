import { reminderSchedule } from '@agenda/core';
import type { AgendaEvent, Locale, ScheduledReminder } from '@agenda/core';
import * as Notifications from 'expo-notifications';

/**
 * Reminders as local notifications. Android keeps the alarms (AlarmManager), so they
 * fire with the app closed, and expo-notifications re-arms them after a reboot. With
 * USE_EXACT_ALARM (app.config.ts) they are exact alarms that also fire while the phone
 * dozes; without it Android would be free to deliver them minutes late.
 */

export const CHANNEL_ID = 'reminders';
/** Two weeks ahead: the schedule is rebuilt each time the app opens or events change. */
export const SCHEDULE_DAYS = 14;

type NotificationsApi = Pick<
  typeof Notifications,
  'cancelAllScheduledNotificationsAsync' | 'scheduleNotificationAsync'
>;

/**
 * Replaces every scheduled reminder with the ones `events` call for: cancel all, then
 * schedule each future reminder once, named by its key (event, offset, start). Running
 * it again with the same events gives the same set, so nothing is ever scheduled twice;
 * a moved or deleted event simply isn't in the new set.
 */
export async function rescheduleReminders(
  events: readonly AgendaEvent[],
  options: { now: Date; timezone: string; locale: Locale; hour12: boolean },
  notifications: NotificationsApi = Notifications,
): Promise<ScheduledReminder[]> {
  const nowMs = options.now.getTime();
  const schedule = reminderSchedule(events, {
    ...options,
    horizonMs: SCHEDULE_DAYS * 24 * 60 * 60_000,
  }).filter((reminder) => reminder.atMs > nowMs);
  await notifications.cancelAllScheduledNotificationsAsync();
  for (const reminder of schedule) {
    await notifications.scheduleNotificationAsync({
      identifier: reminder.key,
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.atMs,
        channelId: CHANNEL_ID,
      },
    });
  }
  return schedule;
}

export type NotificationAccess = 'granted' | 'denied' | 'undetermined';

/**
 * The reminders channel (Android 8+ groups notifications into channels the user can
 * tune), and on Android 13+ the POST_NOTIFICATIONS permission, asked for once.
 */
export async function prepareNotifications(
  notifications: Pick<
    typeof Notifications,
    'setNotificationChannelAsync' | 'getPermissionsAsync' | 'requestPermissionsAsync'
  > = Notifications,
): Promise<NotificationAccess> {
  await notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  const current = await notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const asked = await notifications.requestPermissionsAsync();
  return asked.granted ? 'granted' : asked.canAskAgain ? 'undetermined' : 'denied';
}
