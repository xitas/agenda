import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only cleans up on its own when test globals are enabled; they aren't here.
afterEach(() => {
  cleanup();
});

// jsdom has no pointer capture; Radix uses it for swipe-to-dismiss. Stand-ins only.
// (The stylesheet test runs in the node environment, where there is no Element.)
const proto = typeof Element === 'undefined' ? undefined : Element.prototype;
for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
  if (proto !== undefined && !(name in proto)) {
    Object.defineProperty(proto, name, { value: () => false, configurable: true });
  }
}

// jsdom has no ResizeObserver; Radix's popper (menus) measures with it. A stand-in.
class ResizeObserverStub {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}
if (typeof window !== 'undefined') {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;
}
