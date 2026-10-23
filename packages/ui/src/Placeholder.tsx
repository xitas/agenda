export interface PlaceholderProps {
  label: string;
}

/** Temporary component so the package has something to build and test. */
export function Placeholder({ label }: PlaceholderProps) {
  return <p>{label}</p>;
}
