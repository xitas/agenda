import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { installChromeExtras } from './test-utils/chrome';

configure({ asyncUtilTimeout: 5_000 });

beforeEach(() => {
  // A fresh browser for every test: empty storage, no alarms, no badge.
  fakeBrowser.reset();
  installChromeExtras();
});

afterEach(() => {
  cleanup();
  if (typeof document === 'undefined') return; // the stylesheet test runs in node
  delete document.documentElement.dataset.theme;
});

// jsdom has no pointer capture or ResizeObserver; Radix uses them. Stand-ins only.
for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
  if (typeof Element !== 'undefined' && !(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { value: () => false, configurable: true });
  }
}
class ResizeObserverStub {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;
