import type { AgendaEvent } from '@agenda/core';
import { useEventMutations } from '../data';
import { useSnackbar } from './Snackbar';

/** Deletes at once and offers Undo in the snackbar (DESIGN.md §3: no confirm dialogs). */
export function useDeleteWithUndo() {
  const { remove, restore } = useEventMutations();
  const { show } = useSnackbar();
  return (event: AgendaEvent) => {
    remove.mutate(event, {
      onSuccess: () => {
        show({
          message: `Deleted “${event.title}”.`,
          action: {
            label: 'Undo',
            onPress: () => {
              restore.mutate(event);
            },
          },
        });
      },
      onError: () => {
        show({ message: `Couldn't delete “${event.title}”. Try again.` });
      },
    });
  };
}
