import { ToastProvider } from '@agenda/ui';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test-utils/renderApp';
import { findToastAction } from '../test-utils/toast';
import { listenForInstallPrompt } from './install';
import type { BeforeInstallPromptEvent } from './install';
import { UpdatePrompt } from './UpdatePrompt';
import type { RegisterServiceWorker } from './UpdatePrompt';

describe('UpdatePrompt', () => {
  it('registers once and offers a reload when a new version is waiting', async () => {
    let onNeedRefresh: (() => void) | undefined;
    const update = vi.fn(() => Promise.resolve());
    const register = vi.fn<RegisterServiceWorker>((options) => {
      onNeedRefresh = options.onNeedRefresh;
      return update;
    });
    render(
      <StrictMode>
        <ToastProvider>
          <UpdatePrompt register={register} />
        </ToastProvider>
      </StrictMode>,
    );
    expect(register).toHaveBeenCalledOnce();
    expect(screen.queryByText('Update available.')).toBeNull();

    act(() => {
      onNeedRefresh?.();
    });
    expect(await screen.findByText('Update available.')).toBeDefined();
    await userEvent.setup().click(await findToastAction('Reload'));
    expect(update).toHaveBeenCalledWith(true);
  });
});

describe('Install Agenda', () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  /** A beforeinstallprompt event like Chrome's, with the user's answer. */
  function offerInstall(outcome: 'accepted' | 'dismissed') {
    const event = new Event('beforeinstallprompt', {
      cancelable: true,
    }) as BeforeInstallPromptEvent;
    const prompt = vi.fn(() => Promise.resolve());
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
    act(() => {
      window.dispatchEvent(event);
    });
    return { event, prompt };
  }

  it('is offered in Settings only while the browser offers it, and installs', async () => {
    stop = listenForInstallPrompt(window);
    renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect(screen.queryByRole('region', { name: 'Install' })).toBeNull();

    const { event, prompt } = offerInstall('accepted');
    // Chrome's own mini-infobar is suppressed; Settings offers the install instead.
    expect(event.defaultPrevented).toBe(true);
    const install = await screen.findByRole('region', { name: 'Install' });
    await userEvent.setup().click(within(install).getByRole('button', { name: 'Install Agenda' }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(await screen.findByText('Agenda is installed.')).toBeDefined();
    // A prompt can only be used once.
    expect(screen.queryByRole('region', { name: 'Install' })).toBeNull();
  });

  it('says nothing when the user dismisses it, and hides once installed elsewhere', async () => {
    stop = listenForInstallPrompt(window);
    renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    offerInstall('dismissed');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Install Agenda' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Install' })).toBeNull();
    });
    expect(screen.queryByText('Agenda is installed.')).toBeNull();

    offerInstall('accepted');
    expect(await screen.findByRole('region', { name: 'Install' })).toBeDefined();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('region', { name: 'Install' })).toBeNull();
  });
});
