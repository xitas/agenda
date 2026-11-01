import { normalizeServerUrl, shortcutFromKeys, shortcutKeys } from '@agenda/core';
import type { DesktopBridge, DesktopSettings } from '@agenda/core';
import { Button, Dialog, Input, KEEP_DIALOG_OPEN_ON_ESCAPE } from '@agenda/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { commandError, DESKTOP_SETTINGS_KEY, useDesktopSettings } from './desktopSettings';

export interface DesktopSettingsDialogProps {
  desktop: DesktopBridge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a new Server URL is saved; the page reloads to use it (a test passes a spy). */
  onReconnect?: () => void;
}

/** This computer's own settings: the server, the quick-add shortcut, launch at login. */
export function DesktopSettingsDialog({
  desktop,
  open,
  onOpenChange,
  onReconnect = () => {
    window.location.reload();
  },
}: DesktopSettingsDialogProps) {
  const settings = useDesktopSettings(desktop, open);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desktop settings"
      description="These apply to this computer only."
    >
      {settings.data === undefined ? (
        <p role="status">Loading…</p>
      ) : (
        <div className="desktop-settings">
          <ServerUrlField desktop={desktop} settings={settings.data} onReconnect={onReconnect} />
          <ShortcutField desktop={desktop} shortcut={settings.data.shortcut} />
          <LaunchAtLogin desktop={desktop} enabled={settings.data.launchAtLogin} />
        </div>
      )}
    </Dialog>
  );
}

function ServerUrlField({
  desktop,
  settings,
  onReconnect,
}: {
  desktop: DesktopBridge;
  settings: DesktopSettings;
  onReconnect: () => void;
}) {
  const [value, setValue] = useState(settings.serverUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const result = normalizeServerUrl(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.url === settings.serverUrl) {
      setValue(result.url);
      setError(null);
      return;
    }
    setSaving(true);
    try {
      await desktop.setServerUrl(result.url);
      onReconnect();
    } catch (failure) {
      setError(commandError(failure));
      setSaving(false);
    }
  };

  return (
    <form
      className="desktop-settings__server"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        label="Server URL"
        hint="Where the Agenda API runs. Changing it logs you out on this computer."
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        {...(error === null ? {} : { error })}
      />
      <div>
        <Button type="submit" variant="secondary" loading={saving}>
          Save and reconnect
        </Button>
      </div>
    </form>
  );
}

/** Shows the shortcut; "Change" listens for the next key combination and saves it. */
function ShortcutField({ desktop, shortcut }: { desktop: DesktopBridge; shortcut: string }) {
  const queryClient = useQueryClient();
  const errorId = useId();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    const plain = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
    if (event.key === 'Escape' && plain) {
      setRecording(false);
      setError(null);
      return;
    }
    const result = shortcutFromKeys(event);
    if (result === null) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRecording(false);
    desktop.setShortcut(result.shortcut).then(
      () => {
        setError(null);
        void queryClient.invalidateQueries({ queryKey: DESKTOP_SETTINGS_KEY });
      },
      (failure: unknown) => {
        setError(commandError(failure));
      },
    );
  };

  return (
    <div className="desktop-settings__shortcut">
      <p className="desktop-settings__label">
        Quick add from anywhere:{' '}
        <span className="desktop-settings__keys">
          {shortcutKeys(shortcut).map((key, index) => (
            <span key={key}>
              {index > 0 && ' + '}
              <kbd>{key}</kbd>
            </span>
          ))}
        </span>
      </p>
      <div {...(recording ? { [KEEP_DIALOG_OPEN_ON_ESCAPE]: '' } : {})}>
        <Button
          variant="secondary"
          aria-describedby={error === null ? undefined : errorId}
          onClick={() => {
            setRecording((current) => !current);
            setError(null);
          }}
          onKeyDown={onKeyDown}
        >
          {recording ? 'Press the new shortcut… (Esc to cancel)' : 'Change shortcut'}
        </Button>
      </div>
      {error !== null && (
        <p id={errorId} className="desktop-settings__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function LaunchAtLogin({ desktop, enabled }: { desktop: DesktopBridge; enabled: boolean }) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="desktop-settings__login">
      <label className="desktop-settings__check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            const next = event.target.checked;
            setChecked(next);
            desktop.setLaunchAtLogin(next).then(
              () => {
                setError(null);
                void queryClient.invalidateQueries({ queryKey: DESKTOP_SETTINGS_KEY });
              },
              (failure: unknown) => {
                setChecked(!next);
                setError(commandError(failure));
              },
            );
          }}
        />
        Open Agenda in the tray when you log in
      </label>
      {error !== null && (
        <p className="desktop-settings__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
