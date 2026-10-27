import type { ReactNode } from 'react';
import { EnvContext } from './env';
import type { AppEnv } from './env';

export function EnvProvider({ env, children }: { env: AppEnv; children: ReactNode }) {
  return <EnvContext.Provider value={env}>{children}</EnvContext.Provider>;
}
