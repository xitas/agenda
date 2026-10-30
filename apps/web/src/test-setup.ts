import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy*/waitFor give up after 1 s by default. Rendering the whole app (routes, shell,
// calendar) for the first time in a file took 1.5 s on a busy CI runner, so wait longer.
// A real failure still fails, just a few seconds later.
configure({ asyncUtilTimeout: 5_000 });

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

// jsdom has no ResizeObserver; Radix's popper (the account menu) measures with it.
class ResizeObserverStub {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}
if (typeof window !== 'undefined') {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;
}
