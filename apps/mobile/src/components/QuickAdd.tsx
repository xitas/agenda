import { NetworkError, parseQuickAdd, quickAddPreview } from '@agenda/core';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../context';
import { useEventMutations } from '../data';
import { border, radius, size, space, text, usePalette, weight } from '../theme';
import { useSnackbar } from './Snackbar';

/**
 * One line to add an event ("Lunch with Sara tomorrow 1pm #green", DESIGN.md §3), with a
 * live preview of what will be created; the keyboard's Done key adds it.
 */
export function QuickAdd({ hour12 }: { hour12: boolean }) {
  const { env } = useApp();
  const { color, event: tint } = usePalette();
  const { create } = useEventMutations();
  const { show } = useSnackbar();
  const [value, setValue] = useState('');

  const parsed = useMemo(
    () =>
      value.trim() === ''
        ? null
        : parseQuickAdd(value, { now: env.now(), timezone: env.timezone, locale: env.locale.code }),
    [value, env],
  );
  const preview =
    parsed === null
      ? null
      : quickAddPreview(parsed, { timezone: env.timezone, locale: env.locale, hour12 });

  const submit = () => {
    if (parsed === null) return;
    const typed = value;
    setValue('');
    create.mutate(parsed.draft, {
      onSuccess: () => {
        show({ message: `Added “${parsed.draft.title}”.` });
      },
      onError: (error) => {
        // Give the text back so nothing typed is lost.
        setValue((current) => (current === '' ? typed : current));
        show({
          message:
            error instanceof NetworkError
              ? `Couldn't reach the server, so “${parsed.draft.title}” wasn't added.`
              : `Couldn't add “${parsed.draft.title}”. Try again.`,
        });
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        accessibilityLabel="Quick add"
        accessibilityHint={preview === null ? undefined : `Adds ${preview.title}, ${preview.when}`}
        placeholder="Add an event…"
        placeholderTextColor={color.textMuted}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        returnKeyType="done"
        autoCorrect={false}
        style={[
          styles.input,
          { color: color.text, backgroundColor: color.surface, borderColor: color.borderStrong },
        ]}
      />
      {preview !== null && (
        <View
          testID="quick-add-preview"
          style={[
            styles.chip,
            {
              backgroundColor: tint(preview.color).soft,
              borderLeftColor: tint(preview.color).strong,
            },
          ]}
        >
          <Text style={[styles.title, { color: color.text }]}>{preview.title}</Text>
          <Text style={{ color: color.textMuted, fontSize: text.bodySm }}>{preview.when}</Text>
          <Text style={{ color: color.textMuted, fontSize: text.caption }}>
            {preview.colorName}
          </Text>
          {preview.warnings.map((warning) => (
            <Text key={warning} style={{ color: color.textMuted, fontSize: text.caption }}>
              {warning}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  input: {
    minHeight: size.control.touch,
    paddingHorizontal: space[3],
    borderWidth: border.hairline,
    borderRadius: radius.md,
    fontSize: text.body,
  },
  chip: {
    padding: space[3],
    gap: space[1],
    borderLeftWidth: border.bar,
    borderRadius: radius.sm,
  },
  title: { fontSize: text.body, fontWeight: weight.medium },
});
