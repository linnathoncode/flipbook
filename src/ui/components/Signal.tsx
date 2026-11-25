export function Signal() {
  return (
    <span className="signal" aria-hidden="true">
      {['.', '+', '.', '*', '.', '+', '.', '*', '.', '+', '.'].map((mark, index) => (
        <span key={index} style={{ animationDelay: `${index * 72}ms` }}>{mark}</span>
      ))}
    </span>
  );
}
