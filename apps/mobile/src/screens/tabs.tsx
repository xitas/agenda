import { addMonthsToPlainDate, formatShortDate, monthGrid, plainDateInTz } from '@agenda/core';
import type { Theme, TimeFormat, WeekStart } from '@agenda/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DayList } from '../components/DayList';
import { useEditor } from '../components/EditorSheet';
import { EventRow } from '../components/EventRow';
import { MonthGrid } from '../components/MonthGrid';
import { QuickAdd } from '../components/QuickAdd';
import { AppText, Button, Choice, Field, Section } from '../components/ui';
import { useDeleteWithUndo } from '../components/useDeleteWithUndo';
import { useApp } from '../context';
import { SETTINGS_KEY, useDaysEvents, usePreferences, useSearchEvents } from '../data';
import { space, usePalette } from '../theme';
import { ServerUrlForm } from './session';

function Page({ title, children }: { title: string; children: ReactNode }) {
  const { color } = usePalette();
  return (
    <SafeAreaView style={[styles.page, { backgroundColor: color.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function longDate(day: string, localeCode: string | undefined): string {
  return new Intl.DateTimeFormat(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`));
}

/** Today: QuickAdd, then today's events with the "now" marker (DESIGN.md §4). */
export function TodayScreen() {
  const { env } = useApp();
  const { hour12 } = usePreferences();
  const edit = useEditor();
  const today = plainDateInTz(env.now(), env.timezone);
  const events = useDaysEvents(today, 1);
  return (
    <Page title={longDate(today, env.locale.code)}>
      <QuickAdd hour12={hour12} />
      {events.data === undefined ? (
        <AppText muted>Loading…</AppText>
      ) : (
        <DayList
          events={events.data}
          day={today}
          today={today}
          empty="Nothing today. Enjoy the space."
        />
      )}
      <Button
        label="New event"
        variant="secondary"
        onPress={() => {
          edit({ start: nextHour(env.now()) });
        }}
      />
    </Page>
  );
}

/** The next whole hour: where a new event starts by default. */
export function nextHour(now: Date): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

/** Calendar: the month grid, and under it the chosen day's events. */
export function CalendarScreen() {
  const { env } = useApp();
  const { preferences } = usePreferences();
  const today = plainDateInTz(env.now(), env.timezone);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const weekStart: WeekStart = preferences?.weekStart ?? 'monday';
  const grid = monthGrid(month, weekStart);
  const events = useDaysEvents(grid[0] ?? month, grid.length);
  const title = new Intl.DateTimeFormat(env.locale.code, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}T12:00:00.000Z`));
  const step = (months: number) => {
    setMonth((current) => addMonthsToPlainDate(current, months));
  };
  const dayEvents = (events.data ?? []).filter((event) =>
    event.allDay
      ? event.start <= selected && (event.end ?? event.start) >= selected
      : plainDateInTz(new Date(event.start), env.timezone) <= selected &&
        plainDateInTz(new Date(event.end ?? event.start), env.timezone) >= selected,
  );

  return (
    <Page title={title}>
      <View style={styles.row}>
        <Button
          label="Previous"
          variant="secondary"
          accessibilityLabel="Previous month"
          onPress={() => {
            step(-1);
          }}
        />
        <Button
          label="Today"
          variant="ghost"
          onPress={() => {
            setMonth(`${today.slice(0, 7)}-01`);
            setSelected(today);
          }}
        />
        <Button
          label="Next"
          variant="secondary"
          accessibilityLabel="Next month"
          onPress={() => {
            step(1);
          }}
        />
      </View>
      <MonthGrid
        month={month}
        selected={selected}
        today={today}
        weekStart={weekStart}
        events={events.data ?? []}
        onSelect={setSelected}
      />
      <AppText variant="heading" accessibilityRole="header">
        {longDate(selected, env.locale.code)}
      </AppText>
      <DayList events={dayEvents} day={selected} today={today} empty="Nothing planned." />
    </Page>
  );
}

/** Search across every event's title, location and notes. */
export function SearchScreen() {
  const { env } = useApp();
  const { hour12 } = usePreferences();
  const edit = useEditor();
  const deleteWithUndo = useDeleteWithUndo();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);
  const results = useSearchEvents(debounced);
  const today = plainDateInTz(env.now(), env.timezone);

  return (
    <Page title="Search">
      <Field
        label="Search events"
        placeholder="Title, place or notes"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />
      {debounced !== '' && results.data?.length === 0 && (
        <AppText muted>Nothing matches “{debounced}”.</AppText>
      )}
      {(results.data ?? []).map((event) => {
        const day = event.allDay ? event.start : plainDateInTz(new Date(event.start), env.timezone);
        return (
          <View key={event.id} style={styles.result}>
            <AppText variant="caption" muted>
              {day === today ? 'Today' : formatShortDate(day, env.locale.code)}
            </AppText>
            <EventRow
              event={event}
              day={day}
              hour12={hour12}
              onPress={() => {
                edit({ event });
              }}
              onDelete={() => {
                deleteWithUndo(event);
              }}
            />
          </View>
        );
      })}
    </Page>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
];
const CLOCKS: { value: TimeFormat; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
];

/** Settings: the shared preferences, this phone's server and reminders, devices, log out. */
export function SettingsScreen({
  notifications,
  onOpenNotificationSettings,
}: {
  notifications: string;
  onOpenNotificationSettings: () => void;
}) {
  const { api, tokens, serverUrl } = useApp();
  const client = useQueryClient();
  const { preferences } = usePreferences();
  const [changingServer, setChangingServer] = useState(false);
  // Shown at once, saved in the background. Quick changes in a row must not undo each
  // other: a refetch still running is cancelled, and only the last save refetches.
  const save = useMutation({
    mutationKey: SETTINGS_KEY,
    mutationFn: (next: NonNullable<typeof preferences>) => api.settings.update(next),
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: SETTINGS_KEY });
      client.setQueryData(SETTINGS_KEY, next);
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: SETTINGS_KEY }) === 1) {
        void client.invalidateQueries({ queryKey: SETTINGS_KEY });
      }
    },
  });
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: ({ signal }) => api.auth.sessions({ signal }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => api.auth.revokeOtherSessions(),
    onSettled: () => client.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const logout = useMutation({
    mutationFn: async () => {
      await api.auth.logout();
      await tokens.clear();
    },
    onSuccess: () => {
      client.clear();
      void client.invalidateQueries();
    },
  });

  return (
    <Page title="Settings">
      {preferences !== undefined && (
        <Section title="Appearance">
          <Choice
            label="Theme"
            value={preferences.theme}
            options={THEMES}
            onChange={(theme) => {
              save.mutate({ ...preferences, theme });
            }}
          />
          <Choice
            label="Week starts on"
            value={preferences.weekStart}
            options={WEEK_STARTS}
            onChange={(weekStart) => {
              save.mutate({ ...preferences, weekStart });
            }}
          />
          <Choice
            label="Clock"
            value={preferences.timeFormat}
            options={CLOCKS}
            onChange={(timeFormat) => {
              save.mutate({ ...preferences, timeFormat });
            }}
          />
        </Section>
      )}
      <Section title="This phone">
        {changingServer ? (
          <ServerUrlForm
            onDone={() => {
              setChangingServer(false);
            }}
          />
        ) : (
          <>
            <AppText>Connected to {serverUrl}</AppText>
            <Button
              label="Change server URL"
              variant="secondary"
              onPress={() => {
                setChangingServer(true);
              }}
            />
          </>
        )}
        <AppText>Reminders: {notifications}</AppText>
        {notifications !== 'on' && (
          <Button
            label="Allow notifications"
            variant="secondary"
            onPress={onOpenNotificationSettings}
          />
        )}
      </Section>
      <Section title="Devices">
        {(sessions.data ?? []).map((session) => (
          <AppText key={session.id}>
            {session.label}
            {session.current ? ' (this phone)' : ''}
          </AppText>
        ))}
        {(sessions.data ?? []).some((session) => !session.current) && (
          <Button
            label="Log out everywhere else"
            variant="secondary"
            loading={revokeOthers.isPending}
            onPress={() => {
              revokeOthers.mutate();
            }}
          />
        )}
      </Section>
      <Section title="Account">
        <Button
          label="Log out"
          variant="danger"
          loading={logout.isPending}
          onPress={() => {
            logout.mutate();
          }}
        />
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: space[4], gap: space[4], paddingBottom: space[12] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  result: { gap: space[1] },
});
