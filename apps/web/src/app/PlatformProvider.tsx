import type { Platform } from '@agenda/core';
import type { ReactNode } from 'react';
import { PlatformContext } from './platform';

export function PlatformProvider({
  platform,
  children,
}: {
  platform: Platform;
  children: ReactNode;
}) {
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}
