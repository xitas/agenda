import * as RadixToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button.js';
import { IconButton } from './IconButton.js';
import { ToastContext } from './useToast.js';
import type { ShowToast, ToastOptions } from './useToast.js';

interface ToastItem extends ToastOptions {
  id: number;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Default duration in ms. */
  duration?: number;
  /** Names the toast region for screen readers. */
  label?: string;
}

/**
 * Bottom-center toasts (DESIGN.md §3), e.g. "Event deleted. Undo". Radix provides the
 * live region, pausing on hover/focus, swipe to dismiss and F8 to jump to the toasts.
 */
export function ToastProvider({
  children,
  duration = 5000,
  label = 'Notifications',
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((options) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list, { ...options, id }]);
  }, []);

  const remove = (id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={show}>
      <RadixToast.Provider duration={duration} label={label} swipeDirection="down">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            className="ag-toast"
            {...(toast.duration === undefined ? {} : { duration: toast.duration })}
            onOpenChange={(open) => {
              if (!open) remove(toast.id);
            }}
          >
            <RadixToast.Description className="ag-toast__message">
              {toast.message}
            </RadixToast.Description>
            {toast.action !== undefined && (
              <RadixToast.Action altText={toast.action.altText ?? toast.action.label} asChild>
                <Button variant="ghost" size="sm" onClick={toast.action.onAction}>
                  {toast.action.label}
                </Button>
              </RadixToast.Action>
            )}
            <RadixToast.Close asChild>
              <IconButton label="Dismiss" icon={<X />} size="sm" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="ag-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
