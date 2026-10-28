import type { ReactNode } from 'react';

/**
 * `text` with every case-insensitive occurrence of `query` wrapped in <mark>, which
 * screen readers can announce as highlighted. Matching is literal: no wildcards.
 */
export function highlight(text: string, query: string): ReactNode[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [text];
  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + needle.length)}</mark>);
    from = at + needle.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

export const contains = (text: string | null, query: string) =>
  text?.toLowerCase().includes(query.trim().toLowerCase()) ?? false;

/** Up to `context` characters either side of the first match, with "…" where cut. */
export function snippet(text: string, query: string, context = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = flat.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at === -1) return flat.length > context * 2 ? `${flat.slice(0, context * 2)}…` : flat;
  const start = Math.max(0, at - context);
  const end = Math.min(flat.length, at + query.trim().length + context);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}
