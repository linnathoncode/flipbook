/** Wear ranges in float value, the boundaries every CS2 trader knows by heart. */
const WEAR_RANGES = [
  { name: 'FN', end: 0.07 },
  { name: 'MW', end: 0.15 },
  { name: 'FT', end: 0.38 },
  { name: 'WW', end: 0.45 },
  { name: 'BS', end: 1 },
] as const;

const FLOAT_DIGITS = 6;

export function WearBar({ float }: { float: number }) {
  let start = 0;
  return (
    <span className="wear" title={`Float ${float}`}>
      <span className="wear-track" aria-hidden="true">
        {WEAR_RANGES.map((range) => {
          const width = (range.end - start) * 100;
          start = range.end;
          return <span key={range.name} className={`wear-${range.name.toLowerCase()}`} style={{ width: `${width}%` }} />;
        })}
        <span className="wear-marker" style={{ left: `${float * 100}%` }} />
      </span>
      <span className="mono">{float.toFixed(FLOAT_DIGITS)}</span>
    </span>
  );
}
