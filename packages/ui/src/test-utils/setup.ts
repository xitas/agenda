import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only cleans up on its own when test globals are enabled; they aren't here.
afterEach(() => {
  cleanup();
});
