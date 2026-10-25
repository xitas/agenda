import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import type { ButtonSize, ButtonVariant } from './Button.js';
import { cx } from './cx.js';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Required: an icon-only button has no visible text, so this is its accessible name. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'ag-icon-button',
        `ag-button--${variant}`,
        `ag-icon-button--${size}`,
        className,
      )}
    >
      <span aria-hidden="true" className="ag-icon-button__icon">
        {icon}
      </span>
    </button>
  );
}
