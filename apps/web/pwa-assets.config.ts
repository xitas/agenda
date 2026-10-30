import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// `pnpm --filter @agenda/web icons` renders the PNG icons (and favicon) from
// public/icon.svg into public/. The results are committed, so builds don't need this.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The maskable icon fills its safe zone with the accent (Android crops it to shapes).
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#4F46E5' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#4F46E5' } },
  },
  images: ['public/icon.svg'],
});
