import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { cx } from './cx.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** sm = 32 px, md = 40 px (DESIGN.md §3). */
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and ignores clicks, but stays focusable so keyboard focus isn't lost. */
  loading?: boolean;
  /** An icon before the label (e.g. a lucide icon). */
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  type = 'button',
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      className={cx(
        'ag-button',
        `ag-button--${variant}`,
        `ag-button--${size}`,
        loading && 'ag-button--loading',
        className,
      )}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
    >
      {loading ? <LoaderCircle className="ag-button__spinner" aria-hidden="true" /> : icon}
      <span className="ag-button__label">{children}</span>
      {loading && (
        // The space is its own text node so every accessible-name algorithm keeps it.
        <>
          {' '}
          <span className="ag-visually-hidden">(loading)</span>
        </>
      )}
    </button>
  );
}
