/**
 * Times as people type them, for the editor's time field. The stored form is "HH:mm"
 * (24-hour, zero-padded), which is what event-form.ts expects.
 */

const pad = (value: number) => String(value).padStart(2, '0');
const MINUTES_PER_DAY = 24 * 60;

/**
 * A typed time as "HH:mm", or null. Accepts "16:30", "1630", "9.30", "9", "4pm",
 * "4:30 pm", "12am" (midnight) and "12pm" (noon).
 */
export function parseTimeInput(text: string): string | null {
  const match = /^(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i.exec(text.trim());
  if (match === null) return null;
  let hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (minutes > 59) return null;
  if (meridiem === undefined) {
    if (hours > 23) return null;
  } else {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0);
  }
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "16:30" as shown in the field: "16:30" on a 24-hour clock, "4:30 PM" on a 12-hour one. */
export function formatTimeInput(time: string, hour12: boolean): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  if (!hour12) return `${pad(hours)}:${pad(minutes)}`;
  return `${String(hours % 12 === 0 ? 12 : hours % 12)}:${pad(minutes)} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "HH:mm" moved by `minutes`, wrapping around midnight (for ↑/↓ in the field). */
export function stepTime(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total =
    (((hours * 60 + mins + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
