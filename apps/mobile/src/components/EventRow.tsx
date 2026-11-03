import { eventColorName, timeOnDay } from '@agenda/core';
import type { AgendaEvent } from '@agenda/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useApp } from '../context';
import { border, radius, size, space, text, usePalette, weight } from '../theme';

export interface EventRowProps {
  event: AgendaEvent;
  /** The day this row is listed under: an overnight event shows that day's part. */
  day: string;
  hour12: boolean;
  /** Ended: the title is muted (DESIGN.md §3, Past). */
  past?: boolean;
  onPress: () => void;
  /** Swiping the row away (or the accessibility action) deletes it; Undo is the caller's. */
  onDelete: () => void;
}

/**
 * An event in a list (DESIGN.md §3 EventCard, compact): a bar in the category's strong
 * color on its soft fill, the time and the title. Swipe left to delete.
 */
export function EventRow({ event, day, hour12, past = false, onPress, onDelete }: EventRowProps) {
  const { env } = useApp();
  const { color, event: tint } = usePalette();
  const colors = tint(event.color);
  const time = timeOnDay(event, day, { timezone: env.timezone, locale: env.locale, hour12 });
  const label = [event.title, time, event.location, `Category: ${eventColorName(event.color)}`]
    .filter((part) => part !== null && part !== '')
    .join(', ');

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={size.control.touch * 2}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${event.title}`}
          onPress={onDelete}
          style={[styles.delete, { backgroundColor: color.danger }]}
        >
          <Text style={{ color: color.dangerFg, fontWeight: weight.medium }}>Delete</Text>
        </Pressable>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.LEFT) onDelete();
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the editor. Swipe left to delete."
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'delete') onDelete();
        }}
        onPress={onPress}
        style={[styles.row, { backgroundColor: colors.soft, borderLeftColor: colors.strong }]}
      >
        <Text style={[styles.time, { color: color.textMuted }]}>{time}</Text>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: past ? color.textMuted : color.text }]}
        >
          {event.title}
        </Text>
        {event.location !== null && event.location !== '' && (
          <View style={styles.location}>
            <Text numberOfLines={1} style={{ color: color.textMuted, fontSize: text.caption }}>
              {event.location}
            </Text>
          </View>
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: size.control.touch,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderLeftWidth: border.bar,
    borderRadius: radius.sm,
    gap: space[1],
    justifyContent: 'center',
  },
  time: { fontSize: text.caption, fontVariant: ['tabular-nums'] },
  title: { fontSize: text.body, fontWeight: weight.medium },
  location: { flexDirection: 'row' },
  delete: {
    justifyContent: 'center',
    paddingHorizontal: space[6],
    borderRadius: radius.sm,
    marginLeft: space[2],
  },
});
