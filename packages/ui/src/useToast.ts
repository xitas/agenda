import { createContext, useContext, useMemo } from 'react';

export interface ToastAction {
  /** The visible label, e.g. "Undo". */
  label: string;
  onAction: () => void;
  /** How to do the same without the toast, read to screen readers (Radix requires it). */
  altText?: string;
}

export interface ToastOptions {
  message: string;
  action?: ToastAction;
  /** ms before it hides; hovering or focusing the toast pauses the timer. */
  duration?: number;
}

export type ShowToast = (options: ToastOptions) => void;

export const ToastContext = createContext<ShowToast | null>(null);

/** `const { toast } = useToast(); toast({ message, action })`, inside a ToastProvider. */
export function useToast(): { toast: ShowToast } {
  const show = useContext(ToastContext);
  if (show === null) throw new Error('useToast must be used inside <ToastProvider>');
  return useMemo(() => ({ toast: show }), [show]);
}
