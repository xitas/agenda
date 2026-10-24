import { v7 } from 'uuid';

/** A new UUID v7: time-ordered, so ids sort by creation time and can be made offline. */
export function newId(): string {
  return v7();
}
