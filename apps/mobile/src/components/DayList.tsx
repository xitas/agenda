import { dayAgenda, hasEnded } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useApp } from '../context';
import { usePreferences } from '../data';
import { border, radius, space, usePalette } from '../theme';
import { useEditor } from './EditorSheet';
import { EventRow } from './EventRow';
import { AppText } from './ui';
import { useDeleteWithUndo } from './useDeleteWithUndo';

/**
 * One day's events: all-day first, then by time, with the "now" marker between what has
 * started and what hasn't (core's dayAgenda) when the day is today. Ended events are muted.
 */
export function DayList({
  events,
  day,
  today,
  empty,
}: {
  events: readonly AgendaEvent[];
  day: string;
  today: string;
  empty: string;
}) {
  const { env } = useApp();
  const { color } = usePalette();
  const { hour12 } = usePreferences();
  const edit = useEditor();
  const deleteWithUndo = useDeleteWithUndo();
  const now = env.now();
  const { allDay, timed, nowIndex } = dayAgenda(events, day === today ? now : undefined);

  if (allDay.length + timed.length === 0) {
    return (
      <AppText muted style={styles.empty}>
        {empty}
      </AppText>
    );
  }
  const row = (event: AgendaEvent) => (
    <EventRow
      key={event.id}
      event={event}
      day={day}
      hour12={hour12}
      past={hasEnded(event, now, today)}
      onPress={() => {
        edit({ event });
      }}
      onDelete={() => {
        deleteWithUndo(event);
      }}
    />
  );
  const marker = (
    <View
      key="now"
      accessibilityLabel="Now"
      testID="now-marker"
      style={[styles.now, { backgroundColor: color.accent }]}
    />
  );
  return (
    <View style={styles.list}>
      {allDay.map(row)}
      {timed.map((event, index) => (
        <Fragment key={event.id}>
          {index === nowIndex && marker}
          {row(event)}
        </Fragment>
      ))}
      {nowIndex !== null && nowIndex >= timed.length && marker}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  empty: { paddingVertical: space[4] },
  now: { height: border.focusRing, borderRadius: radius.full, marginVertical: space[1] },
});
