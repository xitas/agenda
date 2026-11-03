import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps, TextProps } from 'react-native';
import { border, radius, size, space, text, usePalette, weight } from '../theme';

/**
 * Native building blocks styled from the design tokens (DESIGN.md §3). React Native has
 * no CSS: styles are objects, layout is Flexbox with a column direction by default, and
 * nothing is inherited except text styles inside <Text>.
 */

export function AppText({
  muted = false,
  variant = 'body',
  style,
  ...rest
}: TextProps & { muted?: boolean; variant?: 'body' | 'small' | 'caption' | 'title' | 'heading' }) {
  const { color } = usePalette();
  return (
    <Text
      {...rest}
      style={[styles[variant], { color: muted ? color.textMuted : color.text }, style]}
    />
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { color } = usePalette();
  const fill = {
    primary: { bg: color.accent, fg: color.accentFg, border: color.accent },
    secondary: { bg: color.surface, fg: color.text, border: color.borderStrong },
    ghost: { bg: 'transparent', fg: color.text, border: 'transparent' },
    danger: { bg: color.danger, fg: color.dangerFg, border: color.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: fill.bg,
          borderColor: fill.border,
          opacity: pressed || disabled ? 0.7 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fill.fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: fill.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string | undefined; hint?: string }) {
  const { color } = usePalette();
  return (
    <View style={styles.field}>
      <AppText variant="small" style={styles.fieldLabel}>
        {label}
      </AppText>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={color.textMuted}
        style={[
          styles.input,
          {
            color: color.text,
            backgroundColor: color.surface,
            borderColor: error === undefined ? color.borderStrong : color.danger,
          },
        ]}
      />
      {error !== undefined ? (
        <AppText variant="caption" style={{ color: color.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : (
        hint !== undefined && (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        )
      )}
    </View>
  );
}

/** A choice among a few (theme, week start, clock): one tappable chip per option. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="small" style={styles.fieldLabel}>
        {label}
      </AppText>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            role="radio"
            onPress={() => {
              onChange(option.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  role = 'checkbox',
  swatch,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
  swatch?: string;
}) {
  const { color } = usePalette();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? color.accent : color.surface,
          borderColor: selected ? color.accent : color.borderStrong,
        },
      ]}
    >
      {swatch !== undefined && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
      <Text style={{ color: selected ? color.accentFg : color.text, fontSize: text.bodySm }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { color } = usePalette();
  return (
    <View
      style={[styles.section, { backgroundColor: color.surface, borderColor: color.border }]}
      accessibilityLabel={title}
    >
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: text.body },
  small: { fontSize: text.bodySm },
  caption: { fontSize: text.caption },
  title: { fontSize: text.title, fontWeight: weight.semibold },
  heading: { fontSize: text.titleSm, fontWeight: weight.semibold },
  button: {
    minHeight: size.control.touch,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: text.body, fontWeight: weight.medium },
  field: { gap: space[1] },
  fieldLabel: { fontWeight: weight.medium },
  input: {
    minHeight: size.control.touch,
    paddingHorizontal: space[3],
    borderWidth: border.hairline,
    borderRadius: radius.md,
    fontSize: text.body,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: size.control.sm,
    paddingHorizontal: space[3],
    borderWidth: border.hairline,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  swatch: { width: space[3], height: space[3], borderRadius: radius.full },
  section: {
    gap: space[3],
    padding: space[4],
    borderWidth: border.hairline,
    borderRadius: radius.lg,
  },
});
