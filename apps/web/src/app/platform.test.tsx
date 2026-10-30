import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePlatform, webPlatform } from './platform';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('webPlatform.saveFile', () => {
  it('downloads the file through a temporary link and frees the URL', async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:agenda/1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const saved = await webPlatform.saveFile({
      name: 'agenda.json',
      mimeType: 'application/json',
      contents: '[]',
    });

    expect(saved).toBe(true);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe('[]');
    // The link the click went to (Vitest records each call's this).
    const clicked = click.mock.contexts[0] as HTMLAnchorElement;
    expect(clicked.download).toBe('agenda.json');
    expect(clicked.getAttribute('href')).toBe('blob:agenda/1');
    // The link is gone, and the URL is freed once the click has been handled.
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:agenda/1');
  });

  it('is required from context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const UsesPlatform = () => {
      usePlatform();
      return null;
    };
    expect(() => render(<UsesPlatform />)).toThrow(
      'usePlatform must be used inside <PlatformProvider>',
    );
  });
});
