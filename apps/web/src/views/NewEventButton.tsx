import { localDateTimeToUtc } from '@agenda/core';
import { Button } from '@agenda/ui';
import { Plus } from 'lucide-react';
import { useEnv } from '../app/env';
import { useEventActions } from '../events/actions';

/** Opens the editor for a new event: at the next whole hour today, or at 09:00 on `day`. */
export function NewEventButton({ day, today }: { day: string; today: string }) {
  const env = useEnv();
  const actions = useEventActions();
  return (
    <Button
      icon={<Plus />}
      onClick={() => {
        actions.create(
          day === today ? undefined : new Date(localDateTimeToUtc(day, '09:00', env.timezone)),
        );
      }}
    >
      New event
    </Button>
  );
}
