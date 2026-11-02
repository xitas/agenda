import { normalizeServerUrl } from '@agenda/core';
import type { ExtensionSettings } from '@agenda/core';
import { Button, Input } from '@agenda/ui';
import { useState } from 'react';
import { useExtension, useExtensionSettings } from './context';

export interface SettingsViewProps {
  onDone: () => void;
  /** After a new server is saved, the page restarts to use it (a test passes a spy). */
  onReconnect?: () => void;
}

/** The extension's own settings: Server URL, web app URL, and reminders in Chrome. */
export function SettingsView({
  onDone,
  onReconnect = () => {
    window.location.reload();
  },
}: SettingsViewProps) {
  const settings = useExtensionSettings();
  if (settings.data === undefined) {
    return (
      <p className="ext-message" role="status">
        Loading…
      </p>
    );
  }
  return <SettingsForm initial={settings.data} onDone={onDone} onReconnect={onReconnect} />;
}

function SettingsForm({
  initial,
  onDone,
  onReconnect,
}: {
  initial: ExtensionSettings;
  onDone: () => void;
  onReconnect: () => void;
}) {
  const { platform } = useExtension();
  const bridge = platform.extension;
  const [serverUrl, setServerUrl] = useState(initial.serverUrl);
  const [webUrl, setWebUrl] = useState(initial.webUrl);
  const [reminders, setReminders] = useState(initial.remindersInChrome);
  const [errors, setErrors] = useState<{ server?: string; web?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = () => {
    const server = normalizeServerUrl(serverUrl);
    const web = normalizeServerUrl(webUrl);
    if (!server.ok || !web.ok) {
      setErrors({
        ...(server.ok ? {} : { server: server.error }),
        ...(web.ok ? {} : { web: web.error }),
      });
      return;
    }
    setErrors({});
    setSaving(true);
    const changed = server.url !== initial.serverUrl;
    // Asked first, while this is still the Save click: Chrome shows the prompt only for a
    // user gesture. Asking for a granted origin answers yes without a prompt.
    void bridge
      .requestServerAccess(server.url)
      .then(async (granted) => {
        if (!granted) {
          setErrors({ server: `Agenda needs your permission to reach ${server.url}.` });
          return;
        }
        await bridge.saveSettings({
          serverUrl: server.url,
          webUrl: web.url,
          remindersInChrome: reminders,
        });
        if (changed) onReconnect();
        else onDone();
      })
      .catch(() => {
        setErrors({ save: 'Couldn’t save the settings. Try again.' });
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <form
      className="ext-settings"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h1 className="ext-settings__title">Settings</h1>
      <Input
        label="Server URL"
        hint="Where the Agenda API runs. Changing it logs you out."
        inputMode="url"
        spellCheck={false}
        value={serverUrl}
        onChange={(event) => {
          setServerUrl(event.target.value);
        }}
        {...(errors.server === undefined ? {} : { error: errors.server })}
      />
      <Input
        label="Web app URL"
        hint="What “Open full Agenda” opens."
        inputMode="url"
        spellCheck={false}
        value={webUrl}
        onChange={(event) => {
          setWebUrl(event.target.value);
        }}
        {...(errors.web === undefined ? {} : { error: errors.web })}
      />
      <label className="ext-settings__check">
        <input
          type="checkbox"
          checked={reminders}
          onChange={(event) => {
            const next = event.target.checked;
            if (!next) {
              setReminders(false);
              return;
            }
            // Notifications are an optional permission, asked for on this click.
            void bridge.requestNotifications().then((granted) => {
              setReminders(granted);
              if (!granted) setErrors({ save: 'Chrome didn’t allow notifications.' });
            });
          }}
        />
        Show reminders in Chrome
      </label>
      <p className="ext-settings__note">
        Leave this off while the desktop app runs, or you’ll get every reminder twice.
      </p>
      {errors.save !== undefined && (
        <p className="ext-settings__error" role="alert">
          {errors.save}
        </p>
      )}
      <div className="ext-settings__actions">
        <Button type="submit" loading={saving}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
