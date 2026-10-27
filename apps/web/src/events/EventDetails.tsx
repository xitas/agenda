import type { AgendaEvent } from '@agenda/core';
import { Button, Dialog } from '@agenda/ui';
import { MapPin, Trash2 } from 'lucide-react';
import { useEnv } from '../app/env';
import { colorName, previewWhen } from '../quick-add/preview';

export interface EventDetailsProps {
  /** The event shown; null closes the dialog. */
  event: AgendaEvent | null;
  onClose: () => void;
  onDelete: (event: AgendaEvent) => void;
}

/** A read-only view of one event, with Delete. Editing comes with the EventEditor. */
export function EventDetails({ event, onClose, onDelete }: EventDetailsProps) {
  const env = useEnv();
  if (event === null) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={event.title}
      description={previewWhen(event, env)}
      footer={
        <Button
          variant="danger"
          icon={<Trash2 />}
          onClick={() => {
            onDelete(event);
            onClose();
          }}
        >
          Delete
        </Button>
      }
    >
      <dl className="event-details" data-event-color={event.color}>
        <div className="event-details__row">
          <dt>Category</dt>
          <dd>
            <span className="event-details__dot" aria-hidden="true" />
            {colorName(event.color)}
          </dd>
        </div>
        {event.location !== null && (
          <div className="event-details__row">
            <dt>
              <MapPin aria-hidden="true" className="event-details__icon" />
              Location
            </dt>
            <dd>{event.location}</dd>
          </div>
        )}
        {event.notes !== '' && (
          <div className="event-details__row">
            <dt>Notes</dt>
            <dd className="event-details__notes">{event.notes}</dd>
          </div>
        )}
      </dl>
    </Dialog>
  );
}
