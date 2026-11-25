const MARKS = ['.', '+', '.', '*', '.', '+', '.', '*', '.', '+', '.'];

export function Signal({ compact = false }: { compact?: boolean }) {
  return (
    <span className="signal" aria-hidden="true">
      {(compact ? MARKS.slice(0, 4) : MARKS).map((mark, index) => (
        <span key={index} style={{ animationDelay: `${index * 72}ms` }}>{mark}</span>
      ))}
    </span>
  );
}
