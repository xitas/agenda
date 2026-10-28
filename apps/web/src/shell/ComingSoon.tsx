import { EmptyState } from '@agenda/ui';
import { Hourglass } from 'lucide-react';

export interface ComingSoonProps {
  /** The view's name, e.g. "Week". */
  title: string;
}

/** A placeholder for views that come in later steps (Week, Month, Search). */
export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <section className="coming-soon" aria-labelledby="coming-soon-title">
      <h1 id="coming-soon-title" className="view-header__heading">
        {title}
      </h1>
      <EmptyState
        icon={<Hourglass />}
        title={`The ${title.toLowerCase()} view is coming soon.`}
        hint="Use Today in the meantime."
      />
    </section>
  );
}
