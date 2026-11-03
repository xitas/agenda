import { eventsByDay, monthGrid } from '@agenda/core';
import type { AgendaEvent, WeekStart } from '@agenda/core';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context';
import { border, radius, size, space, text, usePalette, weight } from '../theme';

/** A month as 6 weeks of days (core's monthGrid); a dot marks days with events. */
export function MonthGrid({
  month,
  selected,
  today,
  weekStart,
  events,
  onSelect,
}: {
  /** Any day in the month. */
  month: string;
  selected: string;
  today: string;
  weekStart: WeekStart;
  events: readonly AgendaEvent[];
  onSelect: (day: string) => void;
}) {
  const { env } = useApp();
  const { color } = usePalette();
  const days = useMemo(() => monthGrid(month, weekStart), [month, weekStart]);
  const byDay = useMemo(
    () => eventsByDay(events, days, env.timezone),
    [events, days, env.timezone],
  );
  const weekday = new Intl.DateTimeFormat(env.locale.code, { weekday: 'narrow', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat(env.locale.code, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);

  return (
    <View accessibilityRole="grid">
      <View style={styles.row}>
        {days.slice(0, 7).map((day) => (
          <Text key={day} style={[styles.weekday, { color: color.textMuted }]} accessible={false}>
            {weekday.format(at(day))}
          </Text>
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((week) => (
        <View key={week} style={styles.row}>
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const count = byDay.get(day)?.length ?? 0;
            const inMonth = day.slice(0, 7) === month.slice(0, 7);
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${full.format(at(day))}${isToday ? ', today' : ''}${
                  count > 0 ? `, ${String(count)} ${count === 1 ? 'event' : 'events'}` : ''
                }`}
                onPress={() => {
                  onSelect(day);
                }}
                style={[
                  styles.cell,
                  isSelected && { backgroundColor: color.accent },
                  !isSelected &&
                    isToday && { borderColor: color.accent, borderWidth: border.focusRing },
                ]}
              >
                <Text
                  style={{
                    fontSize: text.bodySm,
                    fontWeight: isToday ? weight.semibold : weight.regular,
                    color: isSelected ? color.accentFg : inMonth ? color.text : color.textMuted,
                  }}
                >
                  {Number(day.slice(8))}
                </Text>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        count === 0 ? 'transparent' : isSelected ? color.accentFg : color.accent,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: text.caption, paddingVertical: space[1] },
  cell: {
    flex: 1,
    minHeight: size.control.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] / 2,
    borderRadius: radius.md,
  },
  dot: { width: space[1], height: space[1], borderRadius: radius.full },
});
