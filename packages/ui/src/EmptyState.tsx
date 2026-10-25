import { CalendarCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** One friendly line, e.g. "Nothing today. Enjoy the space." */
  title: string;
  /** A next step, e.g. how to quick-add. */
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** DESIGN.md §3: an icon, one friendly line and a quick-add hint. */
export function EmptyState({ title, hint, icon, action }: EmptyStateProps) {
  return (
    <div className="ag-empty">
      <span className="ag-empty__icon" aria-hidden="true">
        {icon ?? <CalendarCheck />}
      </span>
      <p className="ag-empty__title">{title}</p>
      {hint !== undefined && <p className="ag-empty__hint">{hint}</p>}
      {action !== undefined && <div className="ag-empty__action">{action}</div>}
    </div>
  );
}
