import { useId } from 'react';
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

/** A labelled group of radio buttons that saves as soon as one is picked. */
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
  onChange: (value: T) => void;
}) {
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
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
