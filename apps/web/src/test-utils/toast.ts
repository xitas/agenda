import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * A toast's action button, once it can be clicked. Radix keeps the toast region at
 * `pointer-events: none` until the toast's mount effect has run and re-rendered, and on
 * a slow machine the toast's text is in the DOM before that. user-event refuses to click
 * through `pointer-events: none`, so clicking straight after findByRole can fail.
 */
export async function findToastAction(name: string): Promise<HTMLElement> {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => {
    for (let element: Element | null = button; element; element = element.parentElement) {
      expect(getComputedStyle(element).pointerEvents).not.toBe('none');
    }
  });
  return button;
}
