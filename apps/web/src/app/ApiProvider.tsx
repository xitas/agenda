import type { ReactNode } from 'react';
import { ApiContext } from './api';
import type { WebApi } from './api';

export function ApiProvider({ api, children }: { api: WebApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
