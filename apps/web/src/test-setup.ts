import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  if (typeof document === 'undefined') return; // the stylesheet test runs in node
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

// jsdom has no pointer capture; Radix uses it. Stand-ins only.
const proto = typeof Element === 'undefined' ? undefined : Element.prototype;
for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
  if (proto !== undefined && !(name in proto)) {
    Object.defineProperty(proto, name, { value: () => false, configurable: true });
  }
}
