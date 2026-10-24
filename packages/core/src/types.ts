import type { z } from 'zod';
import type {
  AgendaEventSchema,
  EventColorSchema,
  EventCreateSchema,
  EventPatchSchema,
} from './schemas.js';

export type EventColor = z.infer<typeof EventColorSchema>;

/** A stored event, as the API returns it. */
export type AgendaEvent = z.infer<typeof AgendaEventSchema>;

/** What a client may send to create an event (defaulted fields are optional). */
export type EventCreateInput = z.input<typeof EventCreateSchema>;

/** A create request after parsing, with every default filled in. */
export type EventCreate = z.output<typeof EventCreateSchema>;

export type EventPatch = z.infer<typeof EventPatchSchema>;
