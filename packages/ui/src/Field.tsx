import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react';
import { cx } from './cx.js';

interface FieldProps {
  /** Always visible; placeholders are not labels. */
  label: string;
  /** Help text under the control. */
  hint?: string;
  /** Replaces the hint styling with an error, marks the control invalid. */
  error?: string;
}

interface FieldIds {
  id: string;
  describedBy: string | undefined;
}

function useFieldIds(explicitId: string | undefined, hint?: string, error?: string): FieldIds {
  const generated = useId();
  const id = explicitId ?? generated;
  const describedBy = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(' ');
  return { id, describedBy: describedBy === '' ? undefined : describedBy };
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { id: string; required: boolean | undefined; children: ReactNode }) {
  return (
    <div className={cx('ag-field', error !== undefined && 'ag-field--invalid')}>
      <label htmlFor={id} className="ag-field__label">
        {label}
        {required && (
          <span className="ag-field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="ag-field__hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="ag-field__error">
          <CircleAlert aria-hidden="true" className="ag-field__error-icon" />
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends FieldProps, InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ label, hint, error, id, className, required, ...rest }: InputProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame id={ids.id} label={label} hint={hint} error={error} required={required}>
      <input
        {...rest}
        id={ids.id}
        required={required}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={ids.describedBy}
        className={cx('ag-input', className)}
      />
    </FieldFrame>
  );
}

export interface TextareaProps extends FieldProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, hint, error, id, className, required, ...rest }: TextareaProps) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame id={ids.id} label={label} hint={hint} error={error} required={required}>
      <textarea
        {...rest}
        id={ids.id}
        required={required}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={ids.describedBy}
        className={cx('ag-input', 'ag-textarea', className)}
      />
    </FieldFrame>
  );
}
