import {
  EVENT_COLORS,
  eventColorName,
  eventFromForm,
  formatDateInput,
  formatTimeInput,
  formFromEvent,
  newEventForm,
  REMINDER_CHOICES,
} from '@agenda/core';
import type { AgendaEvent, EventForm, EventFormErrors } from '@agenda/core';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useApp } from '../context';
import { useEventMutations, usePreferences } from '../data';
import { border, radius, size, space, text, usePalette, weight } from '../theme';
import { AppText, Button, Chip } from './ui';
import { useDeleteWithUndo } from './useDeleteWithUndo';

const REMINDER_LABELS: Record<(typeof REMINDER_CHOICES)[number], string> = {
  5: '5 min',
  10: '10 min',
  30: '30 min',
  60: '1 hour',
  1440: '1 day',
};

/** Opens the editor: an event to edit, or a start time for a new one. */
type Open = (target: { event: AgendaEvent } | { start: Date }) => void;
const EditorContext = createContext<Open | null>(null);

export function useEditor(): Open {
  const open = useContext(EditorContext);
  if (open === null) throw new Error('useEditor must be used inside <EditorProvider>');
  return open;
}

/** One bottom sheet for the whole app (DESIGN.md §3 EventEditor, mobile: a bottom sheet). */
export function EditorProvider({ children }: { children: ReactNode }) {
  const { env } = useApp();
  const sheet = useRef<BottomSheetModal>(null);
  const [target, setTarget] = useState<{ event: AgendaEvent | null; form: EventForm } | null>(null);
  const open = useCallback<Open>(
    (next) => {
      setTarget(
        'event' in next
          ? { event: next.event, form: formFromEvent(next.event, env.timezone) }
          : { event: null, form: newEventForm(next.start, env.timezone) },
      );
      sheet.current?.present();
    },
    [env.timezone],
  );
  const close = useCallback(() => {
    sheet.current?.dismiss();
  }, []);

  return (
    <EditorContext.Provider value={open}>
      {children}
      <BottomSheetModal
        ref={sheet}
        snapPoints={['92%']}
        enableDynamicSizing={false}
        onDismiss={() => {
          setTarget(null);
        }}
      >
        {target !== null && (
          <EditorForm
            key={target.event?.id ?? 'new'}
            event={target.event}
            initial={target.form}
            onDone={close}
          />
        )}
      </BottomSheetModal>
    </EditorContext.Provider>
  );
}

export function EditorForm({
  event,
  initial,
  onDone,
}: {
  event: AgendaEvent | null;
  initial: EventForm;
  onDone: () => void;
}) {
  const { env } = useApp();
  const { color, event: tint } = usePalette();
  const { hour12 } = usePreferences();
  const { create, update } = useEventMutations();
  const deleteWithUndo = useDeleteWithUndo();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const pick = (key: 'startDate' | 'endDate' | 'startTime' | 'endTime') => {
    const isDate = key.endsWith('Date');
    const value = new Date(
      `${isDate ? form[key] : form.startDate}T${isDate ? '12:00' : form[key]}:00`,
    );
    // Android's own date and time dialogs; the chosen value goes back into the form as
    // the same strings the web editor uses, so core validates both the same way.
    DateTimePickerAndroid.open({
      value,
      mode: isDate ? 'date' : 'time',
      is24Hour: !hour12,
      // Called only when a value is chosen; dismissing the dialog changes nothing.
      onValueChange: (_event, picked) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        set(
          key,
          isDate
            ? `${String(picked.getFullYear())}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}`
            : `${pad(picked.getHours())}:${pad(picked.getMinutes())}`,
        );
      },
    });
  };

  const save = () => {
    const result = eventFromForm(form, env.timezone, event?.timezone ?? env.timezone);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const done = { onSuccess: onDone };
    if (event === null) create.mutate(result.value, done);
    else update.mutate({ id: event.id, patch: result.value }, done);
  };

  const deleteEvent = () => {
    if (event === null) return;
    onDone();
    deleteWithUndo(event);
  };

  const dateLabel = (day: string) => formatDateInput(day, env.locale.code);
  const timeLabel = (time: string) => formatTimeInput(time, hour12);
  const pending = create.isPending || update.isPending;

  return (
    <BottomSheetScrollView contentContainerStyle={styles.body}>
      <AppText variant="title" accessibilityRole="header">
        {event === null ? 'New event' : 'Edit event'}
      </AppText>

      <View style={styles.field}>
        <AppText variant="small" style={styles.label}>
          Title
        </AppText>
        <BottomSheetTextInput
          accessibilityLabel="Title"
          accessibilityHint={errors.title}
          value={form.title}
          onChangeText={(value) => {
            set('title', value);
          }}
          style={[
            styles.input,
            {
              color: color.text,
              backgroundColor: color.surface,
              borderColor: errors.title === undefined ? color.borderStrong : color.danger,
            },
          ]}
        />
        <FieldError message={errors.title} />
      </View>

      <View style={styles.inline}>
        <AppText style={styles.grow}>All day</AppText>
        <Switch
          accessibilityLabel="All day"
          value={form.allDay}
          onValueChange={(value) => {
            set('allDay', value);
          }}
          trackColor={{ true: color.accent, false: color.border }}
        />
      </View>

      <PickerRow label="Starts" error={errors.startDate ?? errors.startTime}>
        <PickerButton
          label={`Start date, ${dateLabel(form.startDate)}`}
          text={dateLabel(form.startDate)}
          onPress={() => {
            pick('startDate');
          }}
        />
        {!form.allDay && (
          <PickerButton
            label={`Start time, ${timeLabel(form.startTime)}`}
            text={timeLabel(form.startTime)}
            onPress={() => {
              pick('startTime');
            }}
          />
        )}
      </PickerRow>
      <PickerRow label="Ends" error={errors.endDate ?? errors.endTime}>
        <PickerButton
          label={`End date, ${dateLabel(form.endDate)}`}
          text={dateLabel(form.endDate)}
          onPress={() => {
            pick('endDate');
          }}
        />
        {!form.allDay && (
          <PickerButton
            label={`End time, ${timeLabel(form.endTime)}`}
            text={timeLabel(form.endTime)}
            onPress={() => {
              pick('endTime');
            }}
          />
        )}
      </PickerRow>

      <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel="Color">
        <AppText variant="small" style={styles.label}>
          Color
        </AppText>
        <View style={styles.chips}>
          {EVENT_COLORS.map((name) => (
            <Chip
              key={name}
              role="radio"
              label={eventColorName(name)}
              swatch={tint(name).strong}
              selected={form.color === name}
              onPress={() => {
                set('color', name);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.field} accessibilityLabel="Reminders">
        <AppText variant="small" style={styles.label}>
          Reminders
        </AppText>
        <View style={styles.chips}>
          {REMINDER_CHOICES.map((minutes) => (
            <Chip
              key={minutes}
              label={`${REMINDER_LABELS[minutes]} before`}
              selected={form.reminders.includes(minutes)}
              onPress={() => {
                set(
                  'reminders',
                  form.reminders.includes(minutes)
                    ? form.reminders.filter((m) => m !== minutes)
                    : [...form.reminders, minutes].sort((a, b) => a - b),
                );
              }}
            />
          ))}
        </View>
      </View>

      {(['location', 'notes'] as const).map((key) => (
        <View key={key} style={styles.field}>
          <AppText variant="small" style={styles.label}>
            {key === 'location' ? 'Location' : 'Notes'}
          </AppText>
          <BottomSheetTextInput
            accessibilityLabel={key === 'location' ? 'Location' : 'Notes'}
            value={form[key]}
            multiline={key === 'notes'}
            onChangeText={(value) => {
              set(key, value);
            }}
            style={[
              styles.input,
              key === 'notes' && styles.notes,
              {
                color: color.text,
                backgroundColor: color.surface,
                borderColor: color.borderStrong,
              },
            ]}
          />
          <FieldError message={errors[key]} />
        </View>
      ))}

      <View style={styles.actions}>
        <Button label="Save" onPress={save} loading={pending} />
        {event !== null && <Button label="Delete" variant="danger" onPress={deleteEvent} />}
        <Button label="Cancel" variant="ghost" onPress={onDone} />
      </View>
    </BottomSheetScrollView>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  const { color } = usePalette();
  if (message === undefined) return null;
  return (
    <AppText variant="caption" style={{ color: color.danger }} accessibilityLiveRegion="polite">
      {message}
    </AppText>
  );
}

function PickerRow({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="small" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.inline}>{children}</View>
      <FieldError message={error} />
    </View>
  );
}

function PickerButton({
  label,
  text: shown,
  onPress,
}: {
  label: string;
  text: string;
  onPress: () => void;
}) {
  const { color } = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.picker, { borderColor: color.borderStrong, backgroundColor: color.surface }]}
    >
      <AppText>{shown}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4], padding: space[4], paddingBottom: space[12] },
  field: { gap: space[1] },
  label: { fontWeight: weight.medium },
  input: {
    minHeight: size.control.touch,
    paddingHorizontal: space[3],
    borderWidth: border.hairline,
    borderRadius: radius.md,
    fontSize: text.body,
  },
  notes: { minHeight: size.control.touch * 2, textAlignVertical: 'top', paddingTop: space[2] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  picker: {
    flex: 1,
    minHeight: size.control.touch,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderWidth: border.hairline,
    borderRadius: radius.md,
  },
  actions: { gap: space[2] },
});

/** For tests and the empty state: the editor's open function without the provider. */
export const EditorTestContext = EditorContext;
