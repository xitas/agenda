import type { Platform, SaveFileRequest } from '@agenda/core';
import { createContext, useContext } from 'react';

/**
 * The web app's platform adapter (ARCHITECTURE.md §7). The desktop app will pass its
 * own (a native save dialog through Tauri) in the same place.
 */
export const webPlatform: Platform = {
  /** A download: a Blob URL clicked through a temporary link. */
  saveFile({ name, mimeType, contents }: SaveFileRequest) {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // The click has started the download; the URL is no longer needed.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    return Promise.resolve(true);
  },
};

export const PlatformContext = createContext<Platform | null>(null);

export function usePlatform(): Platform {
  const platform = useContext(PlatformContext);
  if (platform === null) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return platform;
}
