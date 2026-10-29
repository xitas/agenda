import { ApiError } from '@agenda/core';
import type { ImportReport } from '@agenda/core';
import { Button, useToast } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, FileJson } from 'lucide-react';
import { useId, useState } from 'react';
import { useApi } from '../app/api';
import { useEnv } from '../app/env';
import { usePlatform } from '../app/platform';
import { todayIn } from '../day/dayFormat';
import { failure } from '../events/mutations';
import { EVENTS_KEY } from '../events/queries';
import { SettingsSection } from './SettingsSection';

interface ImportResult {
  report: ImportReport;
  /** Titles from the file, by row, to name the skipped ones. */
  titles: (string | undefined)[];
}

class NotJsonError extends Error {}

/** The title of each row in an export (v1) or an old AgendaData.json (v0), where it has one. */
function titlesOf(data: unknown): (string | undefined)[] {
  if (!Array.isArray(data)) return [];
  return data.map((row: unknown) =>
    typeof row === 'object' && row !== null && 'title' in row && typeof row.title === 'string'
      ? row.title
      : undefined,
  );
}

function importError(error: unknown): string {
  if (error instanceof NotJsonError)
    return "That file isn't JSON. Choose an Agenda export (.json).";
  if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
    return `That file can't be imported: ${error.message}.`;
  }
  return failure(error, 'import the file');
}

/** Import (v0 or v1 JSON, with a report of what was skipped and why) and export. */
export function DataSettings() {
  const api = useApi();
  const env = useEnv();
  const platform = usePlatform();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputId = useId();
  const reportId = useId();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importFailure, setImportFailure] = useState<string | null>(null);
  const today = todayIn(env);

  const importFile = useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new NotJsonError();
      }
      const report = await api.events.importEvents(data, { tz: env.timezone });
      return { report, titles: titlesOf(data) };
    },
    onMutate: () => {
      setResult(null);
      setImportFailure(null);
    },
    onSuccess: (value) => {
      setResult(value);
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    },
    onError: (error) => {
      setImportFailure(importError(error));
    },
  });

  const exportFile = useMutation({
    mutationFn: async (format: 'json' | 'ics') => {
      if (format === 'json') {
        const events = await api.events.exportJson();
        const saved = await platform.saveFile({
          name: `agenda-${today}.json`,
          mimeType: 'application/json',
          contents: `${JSON.stringify(events, null, 2)}\n`,
        });
        return saved
          ? `Exported ${String(events.length)} ${events.length === 1 ? 'event' : 'events'}.`
          : null;
      }
      const ics = await api.events.exportIcs();
      const saved = await platform.saveFile({
        name: `agenda-${today}.ics`,
        mimeType: 'text/calendar',
        contents: ics,
      });
      return saved ? 'Exported your calendar.' : null;
    },
    onSuccess: (message) => {
      if (message !== null) toast({ message });
    },
    onError: (error) => {
      toast({ message: failure(error, 'export your events') });
    },
  });

  const skipped = result?.report.skipped ?? [];

  return (
    <SettingsSection
      title="Data"
      description="Bring events in from a file, or take a copy of all of them."
    >
      <div className="ag-field">
        <label htmlFor={inputId} className="ag-field__label">
          Import from a file
        </label>
        <input
          id={inputId}
          className="settings__file"
          type="file"
          accept="application/json,.json"
          disabled={importFile.isPending}
          aria-describedby={`${inputId}-hint`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear it, so choosing the same file again imports again.
            event.target.value = '';
            if (file !== undefined) importFile.mutate(file);
          }}
        />
        <p id={`${inputId}-hint`} className="ag-field__hint">
          An Agenda export (.json), or an AgendaData.json from the old app. Events that are already
          here are skipped.
        </p>
      </div>

      <div className="settings__report" role="status" aria-live="polite" id={reportId}>
        {importFile.isPending && <p>Importing…</p>}
        {importFailure !== null && <p className="settings__error">{importFailure}</p>}
        {result !== null && (
          <>
            <p>
              Imported {result.report.imported} {result.report.imported === 1 ? 'event' : 'events'}
              {skipped.length > 0 ? `. Skipped ${String(skipped.length)}:` : '.'}
            </p>
            {skipped.length > 0 && (
              <ul className="settings__skipped">
                {skipped.map(({ index, reason }) => {
                  const title = result.titles[index];
                  return (
                    <li key={index}>
                      Row {index + 1}
                      {title === undefined ? '' : ` "${title}"`}: {reason}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="settings__actions">
        <Button
          variant="secondary"
          icon={<FileJson />}
          disabled={exportFile.isPending}
          onClick={() => {
            exportFile.mutate('json');
          }}
        >
          Export as JSON
        </Button>
        <Button
          variant="secondary"
          icon={<CalendarDays />}
          disabled={exportFile.isPending}
          onClick={() => {
            exportFile.mutate('ics');
          }}
        >
          Export calendar (.ics)
        </Button>
      </div>
    </SettingsSection>
  );
}
