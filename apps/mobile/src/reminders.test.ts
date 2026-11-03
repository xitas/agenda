import * as Notifications from 'expo-notifications';
import { enGB } from 'date-fns/locale';
import { CHANNEL_ID, prepareNotifications, rescheduleReminders } from './reminders';
import { event, NOW } from './test-utils/render';

const options = { now: NOW, timezone: 'Asia/Karachi', locale: enGB, hour12: false };
const scheduled = () =>
  jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.map(([request]) => request);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('rescheduleReminders', () => {
  it('cancels everything, then schedules each future reminder once, by its key', async () => {
    // 16:00 in Karachi: reminders at 15:30 and 15:00 today, both still ahead.
    const dentist = event({ reminders: [30, 60], location: 'Clinic' });
    await rescheduleReminders([dentist], options);

    const cancel =
      jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mock.invocationCallOrder[0] ??
      0;
    const first =
      jest.mocked(Notifications.scheduleNotificationAsync).mock.invocationCallOrder[0] ?? 0;
    expect(cancel).toBeLessThan(first);
    expect(scheduled()).toEqual([
      {
        identifier: `${dentist.id}:60:${dentist.start}`,
        content: { title: 'Dentist', body: 'Today, 16:00 – 17:00 · Clinic' },
        trigger: {
          type: 'date',
          date: Date.parse('2026-11-02T10:00:00.000Z'),
          channelId: CHANNEL_ID,
        },
      },
      {
        identifier: `${dentist.id}:30:${dentist.start}`,
        content: { title: 'Dentist', body: 'Today, 16:00 – 17:00 · Clinic' },
        trigger: {
          type: 'date',
          date: Date.parse('2026-11-02T10:30:00.000Z'),
          channelId: CHANNEL_ID,
        },
      },
    ]);
  });

  it('gives the same set every time, so running it again never adds duplicates', async () => {
    const dentist = event({ reminders: [30] });
    const once = await rescheduleReminders([dentist], options);
    const twice = await rescheduleReminders([dentist], options);
    expect(twice).toEqual(once);
    // Each run starts from nothing: two cancels, one reminder each time.
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(new Set(scheduled().map((r) => r.identifier)).size).toBe(1);
  });

  it('follows a moved or deleted event: its old alarm is gone, the new one is set', async () => {
    const dentist = event({ reminders: [30] });
    await rescheduleReminders([dentist], options);
    jest.clearAllMocks();
    const moved = { ...dentist, start: '2026-11-02T13:00:00.000Z', end: null };
    await rescheduleReminders([moved], options);
    expect(scheduled().map((r) => r.identifier)).toEqual([`${dentist.id}:30:${moved.start}`]);
    jest.clearAllMocks();
    await rescheduleReminders([], options);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduled()).toEqual([]);
  });

  it('skips reminders already due, and schedules up to two weeks ahead', async () => {
    const past = event({ start: '2026-11-02T05:20:00.000Z', end: null, reminders: [30] });
    const inTenDays = event({ start: '2026-11-12T05:00:00.000Z', end: null, reminders: [60] });
    const inThreeWeeks = event({ start: '2026-11-23T05:00:00.000Z', end: null, reminders: [60] });
    const schedule = await rescheduleReminders([past, inTenDays, inThreeWeeks], options);
    expect(schedule.map((r) => r.key.split(':')[0])).toEqual([inTenDays.id]);
  });
});

describe('prepareNotifications', () => {
  it('sets up the reminders channel and asks for permission only when it can', async () => {
    expect(await prepareNotifications()).toBe('granted');
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(CHANNEL_ID, {
      name: 'Reminders',
      importance: 4,
    });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();

    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    expect(await prepareNotifications()).toBe('undetermined');

    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValueOnce({ granted: true, canAskAgain: true } as never);
    expect(await prepareNotifications()).toBe('granted');

    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    expect(await prepareNotifications()).toBe('denied');

    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    expect(await prepareNotifications()).toBe('denied');
  });
});
