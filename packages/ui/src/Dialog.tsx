import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
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
}

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
          className="ag-dialog"
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
