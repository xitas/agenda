import '@fontsource-variable/inter';
import '@agenda/tokens/tokens.css';
import '@agenda/ui/styles.css';
import './extension.css';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createExtensionApi } from '../api';
import { browserEnv } from '../env';
import { createChromePlatform } from '../platform';
import type { ChromePlatform } from './context';
import { ExtensionProviders } from './ExtensionProviders';

/** Builds the platform, client and env for an extension page, then renders it. */
export async function mount(page: ReactNode): Promise<void> {
  const platform = (await createChromePlatform()) as ChromePlatform;
  const api = createExtensionApi(platform.apiBaseUrl);
  const root = document.getElementById('root');
  if (root === null) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <ExtensionProviders value={{ api, platform, env: browserEnv() }}>{page}</ExtensionProviders>
    </StrictMode>,
  );
}
