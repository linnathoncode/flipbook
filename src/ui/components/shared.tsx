export function EmptyState({ text }: { text: string }) {
  return <p className="empty muted">{text}</p>;
}

/** CSS class that colors a number by whether it's a gain or a loss. */
export function signClass(value: number): string {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return '';
}
