import { EVENT_COLORS, REMINDER_CHOICES, eventFromForm, plainDateInTz } from '@agenda/core';
import type { EventForm, EventFormErrors, EventFormField, EventFormResult } from '@agenda/core';
import { Button, DateField, Dialog, DialogClose, Input, Textarea, TimeField } from '@agenda/ui';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEnv } from '../app/env';
import { colorName } from '../quick-add/preview';

export interface EventEditorProps {
  /** Create a new event, or edit one (the title says which). */
  mode: 'create' | 'edit';
  initial: EventForm;
  /** Stored on the event: the viewer's zone for a new one, the event's own when editing. */
  eventZone: string;
  onSave: (value: Extract<EventFormResult, { ok: true }>['value'], form: EventForm) => void;
  onClose: () => void;
}

const REMINDER_LABELS: Record<(typeof REMINDER_CHOICES)[number], string> = {
  5: '5 min',
  10: '10 min',
  30: '30 min',
  60: '1 hour',
  1440: '1 day',
};

/** Field order, for moving focus to the first problem. */
const FIELD_ORDER: EventFormField[] = ['title', 'startDate', 'startTime', 'endDate', 'endTime'];

/**
 * The event editor (DESIGN.md §3): a dialog, or a full-height sheet on phones. Checks
 * with core's eventFromForm on Save and then as fields change; Ctrl/Cmd+Enter saves.
 */
export function EventEditor({ mode, initial, eventZone, onSave, onClose }: EventEditorProps) {
  const env = useEnv();
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [tried, setTried] = useState(false);
  const today = plainDateInTz(env.now(), env.timezone);

  const check = (next: EventForm) => eventFromForm(next, env.timezone, eventZone);
  const update = (changes: Partial<EventForm>) => {
    const next = { ...form, ...changes };
    setForm(next);
    // After a failed save, errors follow the fields as they are fixed.
    if (tried) {
      const result = check(next);
      setErrors(result.ok ? {} : result.errors);
    }
  };

  const save = () => {
    setTried(true);
    const result = check(form);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((field) => result.errors[field] !== undefined);
      if (first !== undefined)
        formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] input`)?.focus();
      return;
    }
    onSave(result.value, form);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  // Typed times on the user's clock (the native time input follows the browser's language).
  const timeField = (field: 'startTime' | 'endTime', label: string): ReactNode => (
    <div className="editor__time" data-field={field}>
      <TimeField
        label={label}
        value={form[field]}
        hour12={env.hour12}
        {...(errors[field] === undefined ? {} : { error: errors[field] })}
        onChange={(value) => {
          update({ [field]: value });
        }}
      />
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={mode === 'create' ? 'New event' : 'Edit event'}
      variant="sheet"
      initialFocus={titleRef}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={`${id}-form`}>
            Save
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        ref={formRef}
        className="editor"
        noValidate
        onKeyDown={onKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div data-field="title">
          <Input
            ref={titleRef}
            label="Title"
            value={form.title}
            error={errors.title}
            autoComplete="off"
            onChange={(event) => {
              update({ title: event.target.value });
            }}
          />
        </div>

        <label className="editor__check">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(event) => {
              update({ allDay: event.target.checked });
            }}
          />
          All day
        </label>

        <div className="editor__when">
          <div data-field="startDate">
            <DateField
              label="Start date"
              value={form.startDate}
              today={today}
              locale={env.locale}
              weekStart={env.weekStart}
              error={errors.startDate}
              onChange={(startDate) => {
                update({ startDate });
              }}
            />
          </div>
          {!form.allDay && timeField('startTime', 'Start time')}
          <div data-field="endDate">
            <DateField
              label="End date"
              value={form.endDate}
              today={today}
              locale={env.locale}
              weekStart={env.weekStart}
              error={errors.endDate}
              onChange={(endDate) => {
                update({ endDate });
              }}
            />
          </div>
          {!form.allDay && timeField('endTime', 'End time')}
        </div>

        <fieldset className="editor__group">
          <legend className="ag-field__label">Color</legend>
          <div className="editor__colors">
            {EVENT_COLORS.map((color) => (
              <label key={color} className="editor__color" data-event-color={color}>
                <input
                  type="radio"
                  name={`${id}-color`}
                  value={color}
                  checked={form.color === color}
                  onChange={() => {
                    update({ color });
                  }}
                />
                <span className="editor__swatch" aria-hidden="true" />
                {colorName(color)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="editor__group">
          <legend className="ag-field__label">Reminders</legend>
          <div className="editor__reminders">
            {REMINDER_CHOICES.map((minutes) => (
              <label key={minutes} className="editor__chip">
                <input
                  type="checkbox"
                  checked={form.reminders.includes(minutes)}
                  onChange={(event) => {
                    update({
                      reminders: event.target.checked
                        ? [...form.reminders, minutes]
                        : form.reminders.filter((value) => value !== minutes),
                    });
                  }}
                />
                {REMINDER_LABELS[minutes]} before
              </label>
            ))}
          </div>
          <p className="ag-field__hint">
            {form.reminders.length === 0 ? 'No reminders.' : 'You can pick more than one.'}
          </p>
        </fieldset>

        <Input
          label="Location"
          value={form.location}
          autoComplete="off"
          onChange={(event) => {
            update({ location: event.target.value });
          }}
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(event) => {
            update({ notes: event.target.value });
          }}
        />
        <p className="editor__tip">Ctrl+Enter or ⌘+Enter saves.</p>
      </form>
    </Dialog>
  );
}
