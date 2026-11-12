import {
  ApiError,
  isUnreachable,
  loginErrorMessage,
  normalizeServerUrl,
  unreachableMessage,
} from '@agenda/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Field } from '../components/ui';
import { useApp } from '../context';
import { SESSION_KEY, useSession } from '../data';
import { space, usePalette } from '../theme';

/** The session's name in Settings > Devices on every app. */
export const SESSION_LABEL = 'Android phone';

function Screen({ children }: { children: ReactNode }) {
  const { color } = usePalette();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: color.bg }]}>
      <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Where the app talks to: phones only allow plain http:// to local addresses. */
export function ServerUrlForm({ onDone }: { onDone: () => void }) {
  const { serverUrl, changeServer } = useApp();
  const [value, setValue] = useState(serverUrl);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const save = () => {
    const result = normalizeServerUrl(value, { httpsOutsideLocal: true });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    void changeServer(result.url).then(onDone, () => {
      setSaving(false);
      setError('Couldn’t save the address. Try again.');
    });
  };
  return (
    <View style={styles.form}>
      <Field
        label="Server URL"
        hint="Your PC’s address and port, like http://192.168.1.20:4001. Changing it logs you out."
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setError(undefined);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={error}
      />
      <Button label="Save" onPress={save} loading={saving} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </View>
  );
}

/** Password only, as a token client; the token goes to the Keystore. */
export function LoginScreen() {
  const { api, tokens, serverUrl } = useApp();
  const client = useQueryClient();
  const [password, setPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const login = useMutation({
    mutationFn: async (value: string) => {
      const { token, session } = await api.auth.login(value, { label: SESSION_LABEL });
      await tokens.set(token);
      return session;
    },
    onSuccess: (session) => {
      client.setQueryData(SESSION_KEY, session);
      void client.invalidateQueries();
    },
  });

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Agenda
      </AppText>
      {changing ? (
        <ServerUrlForm
          onDone={() => {
            setChanging(false);
          }}
        />
      ) : (
        <View style={styles.form}>
          <AppText muted>Log in to see your agenda.</AppText>
          <Field
            label="Password"
            secureTextEntry
            autoFocus
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => {
              login.mutate(password);
            }}
            error={login.isError ? loginErrorMessage(login.error, serverUrl) : undefined}
          />
          <Button
            label="Log in"
            onPress={() => {
              login.mutate(password);
            }}
            loading={login.isPending}
          />
          <View style={styles.serverLine}>
            <AppText variant="small" muted style={styles.grow}>
              Server: {serverUrl}
            </AppText>
            <Button
              label="Change"
              variant="ghost"
              accessibilityLabel="Change server"
              onPress={() => {
                setChanging(true);
              }}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

/** "Can't reach Agenda at <url>" (DESIGN.md §4), with Retry and the Server URL. */
export function UnreachableScreen({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const { serverUrl } = useApp();
  const [changing, setChanging] = useState(false);
  const [title, hint] = unreachableMessage(serverUrl).split('. ');
  return (
    <Screen>
      {changing ? (
        <ServerUrlForm
          onDone={() => {
            setChanging(false);
          }}
        />
      ) : (
        <View style={styles.form} accessibilityLiveRegion="polite">
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          <AppText muted>{hint}</AppText>
          <Button label="Retry" onPress={onRetry} loading={retrying} />
          <Button
            label="Change server URL"
            variant="ghost"
            onPress={() => {
              setChanging(true);
            }}
          />
        </View>
      )}
    </Screen>
  );
}

/** What every signed-in screen needs first: a session, or login, or "Can't reach". */
export function SessionGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const retry = () => {
    void session.refetch();
  };
  if (session.isPending) {
    return (
      <Screen>
        <AppText muted accessibilityRole="progressbar">
          Loading your agenda…
        </AppText>
      </Screen>
    );
  }
  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401) return <LoginScreen />;
    if (isUnreachable(session.error)) {
      return <UnreachableScreen onRetry={retry} retrying={session.isFetching} />;
    }
    return (
      <Screen>
        <AppText>Something went wrong loading your agenda. Try again.</AppText>
        <Button label="Try again" variant="secondary" onPress={retry} />
      </Screen>
    );
  }
  return children;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flexGrow: 1, justifyContent: 'center', padding: space[6], gap: space[4] },
  form: { gap: space[3] },
  serverLine: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  grow: { flex: 1 },
});
