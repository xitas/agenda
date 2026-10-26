import { Monitor, Moon, Sun } from 'lucide-react';
import { useId, useState } from 'react';
import { applyTheme, readTheme } from './theme';
import type { ThemeChoice } from './theme';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/** A segmented control built on native radio buttons, so arrow keys work out of the box. */
export function ThemeSwitcher() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readTheme());
  const name = useId();

  return (
    <fieldset className="theme-switcher">
      <legend className="ag-visually-hidden">Theme</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <label key={value} className="theme-switcher__option">
          <input
            type="radio"
            name={name}
            value={value}
            checked={choice === value}
            onChange={() => {
              setChoice(value);
              applyTheme(value);
            }}
            className="theme-switcher__input"
          />
          <Icon aria-hidden="true" className="theme-switcher__icon" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
