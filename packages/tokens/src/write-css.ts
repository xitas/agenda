/// <reference types="node" />
// Writes dist/tokens.css next to the compiled code. `pnpm build` runs it after tsc.
import { writeFileSync } from 'node:fs';
import { toCss } from './css.js';

writeFileSync(new URL('./tokens.css', import.meta.url), toCss());
