import { Button, IconButton } from '@agenda/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ViewHeaderProps {
  headingId: string;
  title: string;
  /** A short line above the title, e.g. "Today" or "This week". */
  eyebrow?: string | undefined;
  /** "day", "week", "month" or "3 days": used in the arrow labels. */
  period: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** The period on screen contains today. */
  showsToday: boolean;
  /** Extra controls after the arrows, e.g. "New event". */
  actions?: ReactNode;
}

/** The title and previous / Today / next controls shared by the Day, Week and Month views. */
export function ViewHeader({
  headingId,
  title,
  eyebrow,
  period,
  onPrevious,
  onNext,
  onToday,
  showsToday,
  actions,
}: ViewHeaderProps) {
  return (
    <header className="view-header">
      <div className="view-header__titles">
        {eyebrow !== undefined && <p className="view-header__eyebrow">{eyebrow}</p>}
        <h1 id={headingId} className="view-header__heading">
          {title}
        </h1>
      </div>
      <div className="view-header__nav">
        <IconButton
          label={`Previous ${period}`}
          icon={<ChevronLeft />}
          variant="secondary"
          onClick={onPrevious}
        />
        <Button variant="secondary" disabled={showsToday} onClick={onToday}>
          Today
        </Button>
        <IconButton
          label={`Next ${period}`}
          icon={<ChevronRight />}
          variant="secondary"
          onClick={onNext}
        />
        {actions}
      </div>
    </header>
  );
}
