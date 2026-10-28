import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { IconButton } from './IconButton.js';

export interface DialogProps {
  /** Controlled open state; leave out (with `trigger`) to let the dialog manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element that opens the dialog; focus returns to it on close. */
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Actions, e.g. Cancel and Save buttons. */
  footer?: ReactNode;
  closeLabel?: string;
  /** sheet: full height below 768 px (the event editor on phones). */
  variant?: 'dialog' | 'sheet';
  /** What gets focus on open; by default the first focusable element (the close button). */
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * Esc normally closes the dialog, before anything inside it sees the key (Radix listens
 * on the document). A part of the dialog that uses Esc itself, like an open calendar,
 * marks itself with this attribute and handles the key instead.
 */
export const KEEP_DIALOG_OPEN_ON_ESCAPE = 'data-keep-dialog-open';

/**
 * A modal dialog (DESIGN.md §3 EventEditor on web/desktop). Radix provides the focus
 * trap, Esc to close, returning focus to the trigger, scroll lock and the ARIA wiring.
 */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  variant = 'dialog',
  initialFocus,
}: DialogProps) {
  return (
    <RadixDialog.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      {trigger !== undefined && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ag-dialog__overlay" />
        <RadixDialog.Content
          className={variant === 'sheet' ? 'ag-dialog ag-dialog--sheet' : 'ag-dialog'}
          onEscapeKeyDown={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest(`[${KEEP_DIALOG_OPEN_ON_ESCAPE}]`) !== null
            ) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event) => {
            if (initialFocus?.current) {
              event.preventDefault();
              initialFocus.current.focus();
            }
          }}
          // Without a description there is nothing to point at; say so explicitly.
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
        >
          <div className="ag-dialog__header">
            <RadixDialog.Title className="ag-dialog__title">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label={closeLabel} icon={<X />} size="sm" />
            </RadixDialog.Close>
          </div>
          {description !== undefined && (
            <RadixDialog.Description className="ag-dialog__description">
              {description}
            </RadixDialog.Description>
          )}
          {children !== undefined && <div className="ag-dialog__body">{children}</div>}
          {footer !== undefined && <div className="ag-dialog__footer">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Wrap a footer button in this to make it close the dialog. */
export const DialogClose = RadixDialog.Close;
