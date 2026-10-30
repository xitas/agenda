import { startTransition, useId, useOptimistic } from 'react';
import type { ReactNode } from 'react';

/** A titled block on the Settings page. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="settings__section" aria-labelledby={id}>
      <header className="settings__head">
        <h2 id={id} className="settings__title">
          {title}
        </h2>
        {description !== undefined && <p className="settings__description">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A labelled group of radio buttons that saves as soon as one is picked. The pick shows
 * at once as an optimistic value (useOptimistic) while the save runs: the saved value
 * reaches the page through the query cache a tick later, and a radio fed only by it
 * would show unticked in between. When the save ends, the group shows the saved value,
 * which is the pick if it worked and the old value if it was rolled back.
 */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  /** Saves the pick; resolves when the save has finished, whether it worked or not. */
  onChange: (value: T) => Promise<unknown>;
}) {
  const [selected, setSelected] = useOptimistic(value);
  return (
    <fieldset className="settings__choices">
      <legend className="ag-field__label">{legend}</legend>
      <div className="settings__options">
        {options.map((option) => (
          <label key={option.value} className="settings__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected === option.value}
              onChange={() => {
                startTransition(async () => {
                  setSelected(option.value);
                  await onChange(option.value);
                });
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
