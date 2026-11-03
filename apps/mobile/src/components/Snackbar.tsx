import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, text, usePalette, weight } from '../theme';

export interface SnackbarMessage {
  message: string;
  /** e.g. Undo after a delete (DESIGN.md §3: Undo is preferred over confirm dialogs). */
  action?: { label: string; onPress: () => void };
}

/** How long a message stays: long enough to reach Undo. */
export const SNACKBAR_MS = 5_000;

const SnackbarContext = createContext<{ show: (message: SnackbarMessage) => void } | null>(null);

export function useSnackbar() {
  const value = useContext(SnackbarContext);
  if (value === null) throw new Error('useSnackbar must be used inside <SnackbarProvider>');
  return value;
}

/** One message at a time at the bottom of the screen, above the tab bar. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const { color } = usePalette();
  const [current, setCurrent] = useState<(SnackbarMessage & { id: number }) | null>(null);
  const show = useCallback((message: SnackbarMessage) => {
    setCurrent({ ...message, id: Date.now() });
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (current === null) return;
    const timer = setTimeout(() => {
      setCurrent(null);
    }, SNACKBAR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [current]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current !== null && (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.bar, { backgroundColor: color.text }]}
          pointerEvents="box-none"
        >
          <Text style={[styles.message, { color: color.bg }]}>{current.message}</Text>
          {current.action !== undefined && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                current.action?.onPress();
                setCurrent(null);
              }}
              style={styles.action}
            >
              <Text style={[styles.actionLabel, { color: color.bg }]}>{current.action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    bottom: space[8] * 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  message: { flex: 1, fontSize: text.bodySm },
  action: { paddingVertical: space[1], paddingHorizontal: space[2] },
  actionLabel: { fontSize: text.bodySm, fontWeight: weight.semibold },
});
