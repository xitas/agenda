import { formatTimeInput, usesTwelveHour } from '@agenda/core';
import type { Settings } from '@agenda/core';
import { useId } from 'react';
import { useEnv } from '../app/env';
import { useSettings, useUpdateSettings } from '../app/settings';
import { ChoiceGroup, SettingsSection } from './SettingsSection';

/** Theme, week start and clock: shared by every device, applied at once. */
export function AppearanceSettings() {
  const env = useEnv();
  const name = useId();
  const settings = useSettings();
  const { save } = useUpdateSettings();
  const set = (changes: Partial<Settings>) => save({ ...settings, ...changes });
  const example = (hour12: boolean) => formatTimeInput('16:30', hour12);
  const localeClock = example(usesTwelveHour('auto', env.locale.code));

  return (
    <SettingsSection
      title="Appearance"
      description="These follow you to every device you use Agenda on."
    >
      <ChoiceGroup
        legend="Theme"
        name={`${name}-theme`}
        value={settings.theme}
        options={[
          { value: 'system', label: 'Match the system' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(theme) => set({ theme })}
      />
      <ChoiceGroup
        legend="Week starts on"
        name={`${name}-week`}
        value={settings.weekStart}
        options={[
          { value: 'monday', label: 'Monday' },
          { value: 'sunday', label: 'Sunday' },
        ]}
        onChange={(weekStart) => set({ weekStart })}
      />
      <ChoiceGroup
        legend="Time format"
        name={`${name}-time`}
        value={settings.timeFormat}
        options={[
          { value: 'auto', label: `Automatic (${localeClock})` },
          { value: '24h', label: `24-hour (${example(false)})` },
          { value: '12h', label: `12-hour (${example(true)})` },
        ]}
        onChange={(timeFormat) => set({ timeFormat })}
      />
    </SettingsSection>
  );
}
