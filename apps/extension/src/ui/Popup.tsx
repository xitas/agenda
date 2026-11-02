import { NetworkError, parseQuickAdd, plainDateInTz, quickAddPreview } from '@agenda/core';
import { IconButton, QuickAddField } from '@agenda/ui';
import { PanelRight, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useExtension, useExtensionSettings, usePreferences } from './context';
import { EventList } from './EventList';
import { useAddEvent, useDaysEvents } from './events';
import { SessionGate } from './SessionGate';
import { SettingsView } from './SettingsView';

/** "Monday 2 November" for the popup's header. */
function longDate(now: Date, timezone: string, localeCode: string | undefined): string {
  return new Intl.DateTimeFormat(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(now);
}

export interface PopupProps {
  /** Opens Chrome's side panel; a test passes a spy. */
  openSidePanel?: () => void;
  /** Passed to the settings view (restart after a new server). */
  onReconnect?: () => void;
}

/**
 * The toolbar popup (360×520, DESIGN.md §4): the date and settings, QuickAdd, today's
 * events, and a link to the full app.
 */
export function Popup({ openSidePanel, onReconnect }: PopupProps) {
  const { env, platform } = useExtension();
  const settings = useExtensionSettings();
  const [showSettings, setShowSettings] = useState(false);
  const now = env.now();

  return (
    <div className="ext-popup">
      <header className="ext-popup__header">
        <p className="ext-popup__date">{longDate(now, env.timezone, env.locale.code)}</p>
        {openSidePanel !== undefined && (
          <IconButton
            label="Open this week in the side panel"
            icon={<PanelRight />}
            onClick={openSidePanel}
          />
        )}
        <IconButton
          label="Settings"
          icon={<Settings />}
          aria-pressed={showSettings}
          onClick={() => {
            setShowSettings((open) => !open);
          }}
        />
      </header>
      <main className="ext-popup__body">
        {showSettings ? (
          <SettingsView
            onDone={() => {
              setShowSettings(false);
            }}
            {...(onReconnect === undefined ? {} : { onReconnect })}
          />
        ) : (
          <SessionGate
            onChangeServer={() => {
              setShowSettings(true);
            }}
          >
            <Today />
          </SessionGate>
        )}
      </main>
      <footer className="ext-popup__footer">
        <a
          className="ext-popup__open"
          href={settings.data?.webUrl ?? '#'}
          onClick={(event) => {
            event.preventDefault();
            if (settings.data !== undefined) void platform.extension.openTab(settings.data.webUrl);
          }}
        >
          Open full Agenda →
        </a>
      </footer>
    </div>
  );
}

/** QuickAdd and today's list, once logged in. */
function Today() {
  const { env } = useExtension();
  const { hour12 } = usePreferences();
  const today = plainDateInTz(env.now(), env.timezone);
  const events = useDaysEvents(today, 1);
  const add = useAddEvent();
  const [text, setText] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const parsed = useMemo(
    () =>
      text.trim() === ''
        ? null
        : parseQuickAdd(text, { now: env.now(), timezone: env.timezone, locale: env.locale.code }),
    [text, env],
  );
  const options = {
    timezone: env.timezone,
    locale: env.locale,
    ...(hour12 === undefined ? {} : { hour12 }),
  };

  const submit = () => {
    if (parsed === null) return;
    const typed = text;
    setText('');
    setFailure(null);
    add.mutate(parsed.draft, {
      onError: (error) => {
        // Give the text back so nothing typed is lost.
        setText((current) => (current === '' ? typed : current));
        setFailure(
          error instanceof NetworkError
            ? `Couldn't reach the server, so "${parsed.draft.title}" wasn't added. Try again.`
            : `Couldn't add "${parsed.draft.title}". Try again.`,
        );
      },
    });
  };

  return (
    <>
      <QuickAddField
        layout="inline"
        autoFocus
        value={text}
        onChange={setText}
        onSubmit={submit}
        onEscape={() => {
          setText('');
        }}
        preview={parsed === null ? null : quickAddPreview(parsed, options)}
      />
      {failure !== null && (
        <p className="ext-error" role="alert">
          {failure}
        </p>
      )}
      <h2 className="ext-heading">Today</h2>
      {events.data === undefined ? (
        <p className="ext-message" role="status">
          Loading…
        </p>
      ) : (
        <EventList
          events={events.data}
          day={today}
          today={today}
          hour12={hour12}
          empty="Nothing today. Enjoy the space."
        />
      )}
    </>
  );
}
