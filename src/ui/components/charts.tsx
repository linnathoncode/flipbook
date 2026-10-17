import type { Analytics } from '../../domain/analytics';
import { KIND_PLURAL } from '../../domain/itemKinds';
import { formatMonth, formatSignedMoney } from '../format';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUS = '−';
/** Charts may grow this far past their drawn size before the text inside starts to look oversized. */
const CHART_STRETCH = 1.25;

/** Round axis steps (1, 2, 2.5, 5 × 10ⁿ) that cover lo..hi in about `count` steps. */
function ticks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo || 1) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw)!;
  const values: number[] = [];
  for (let value = Math.floor(lo / step) * step; value <= Math.ceil(hi / step) * step + 1e-9; value += step) {
    values.push(Number(value.toFixed(6)));
  }
  return values;
}

const axisMoney = (value: number) => `${value < 0 ? MINUS : ''}$${Math.abs(value).toFixed(Math.abs(value) % 1 ? 1 : 0)}`;

/** Running net profit as a step line: it only moves on the day something sells. */
export function CumulativeChart({ data }: { data: Analytics }) {
  const [width, height, left, right, top, bottom] = [640, 230, 52, 18, 22, 26];
  const start = Date.parse(data.from);
  const end = Math.max(Date.parse(data.to), start + DAY_MS);
  const values = [0, ...data.cumulative.map((point) => point.total)];
  const scale = ticks(Math.min(...values), Math.max(...values, 1), 4);
  const [lo, hi] = [scale[0], scale[scale.length - 1]];
  const x = (time: number) => left + ((time - start) / (end - start)) * (width - left - right);
  const y = (value: number) => top + ((hi - value) / (hi - lo)) * (height - top - bottom);

  let line = `M${x(start)},${y(0)}`;
  data.cumulative.forEach((point) => {
    line += ` H${x(Date.parse(point.at)).toFixed(1)} V${y(point.total).toFixed(1)}`;
  });
  line += ` H${x(end)}`;

  const months = data.byMonth
    .map((month) => Date.parse(`${month.month}-01T00:00:00Z`))
    .filter((time) => time >= start && time <= end);

  return (
    <svg className="chart" style={{ maxWidth: width * CHART_STRETCH }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Net profit over time, ending at ${formatSignedMoney(data.net)}`}>
      {scale.map((value) => (
        <g key={value}>
          <line className={value === 0 ? 'ch-zero' : 'ch-grid'} x1={left} x2={width - right} y1={y(value)} y2={y(value)} />
          <text className="ch-axis" x={left - 8} y={y(value) + 3.5} textAnchor="end">{axisMoney(value)}</text>
        </g>
      ))}
      {months.map((time) => (
        <g key={time}>
          <line className="ch-grid" x1={x(time)} x2={x(time)} y1={height - bottom} y2={height - bottom + 4} />
          <text className="ch-axis" x={x(time) + 3} y={height - 8}>{formatMonth(new Date(time).toISOString().slice(0, 7))}</text>
        </g>
      ))}
      <path className="ch-area" d={`${line} V${y(0)} Z`} />
      <path className="ch-line" d={line} pathLength={1} />
      <circle className="ch-dot" cx={x(end)} cy={y(data.net)} r={4.5} />
      <text className="ch-lbl" x={x(end) - 8} y={y(data.net) - 10} textAnchor="end">{formatSignedMoney(data.net)}</text>
    </svg>
  );
}

export function MonthChart({ data }: { data: Analytics }) {
  const [width, height, left, right, top, bottom] = [380, 240, 46, 6, 22, 36];
  const values = data.byMonth.map((month) => month.net);
  const scale = ticks(Math.min(0, ...values), Math.max(1, ...values), 4);
  const [lo, hi] = [scale[0], scale[scale.length - 1]];
  const y = (value: number) => top + ((hi - value) / (hi - lo)) * (height - top - bottom);
  const band = (width - left - right) / Math.max(1, data.byMonth.length);
  const barWidth = Math.min(48, band * 0.56);
  // Labels on every bar get crowded past half a year.
  const labelled = data.byMonth.length <= 6;
  const step = monthStep(band);
  // The first bar names its year too, unless a January right after it would collide with that label.
  const firstJanuary = data.byMonth.findIndex((month) => monthOf(month.month) === 0);
  const firstJanuaryGap = firstJanuary === -1 ? Infinity : firstJanuary;

  return (
    <svg className="chart" style={{ maxWidth: width * CHART_STRETCH }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Net profit by month">
      {scale.map((value) => (
        <g key={value}>
          <line className={value === 0 ? 'ch-zero' : 'ch-grid'} x1={left} x2={width - right} y1={y(value)} y2={y(value)} />
          <text className="ch-axis" x={left - 8} y={y(value) + 3.5} textAnchor="end">{axisMoney(value)}</text>
        </g>
      ))}
      {data.byMonth.map((month, index) => {
        const center = left + band * index + band / 2;
        const barTop = y(Math.max(month.net, 0));
        const barHeight = Math.max(1, Math.abs(y(month.net) - y(0)));
        return (
          <g key={month.month}>
            <rect className={month.net >= 0 ? 'ch-pos' : 'ch-neg'} x={center - barWidth / 2} y={barTop} width={barWidth} height={barHeight} rx={2}>
              <title>{`${formatMonth(month.month)}: ${formatSignedMoney(month.net)}`}</title>
            </rect>
            {labelled && month.net !== 0 && (
              <text className="ch-lbl" x={center} y={month.net >= 0 ? barTop - 6 : barTop + barHeight + 13} textAnchor="middle">
                {formatSignedMoney(month.net)}
              </text>
            )}
            {monthOf(month.month) % step === 0 && (
              <text className="ch-axis" x={center} y={height - bottom + 14} textAnchor="middle">{formatMonth(month.month)}</text>
            )}
            {(monthOf(month.month) === 0 || (index === 0 && firstJanuaryGap * band >= MONTH_LABEL_WIDTH)) && (
              <text className="ch-axis ch-year" x={center} y={height - bottom + 28} textAnchor="middle">{month.month.slice(0, 4)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Room a month label needs, in chart units. */
const MONTH_LABEL_WIDTH = 34;

/** Label every month, or every 2nd, quarter, half or January, whichever is the first that fits. */
function monthStep(band: number): number {
  return [1, 2, 3, 6, 12].find((step) => band * step >= MONTH_LABEL_WIDTH) ?? 12;
}

/** 0 for January through 11 for December, from "2026-03". */
const monthOf = (month: string) => Number(month.slice(5, 7)) - 1;

export function KindBars({ data }: { data: Analytics }) {
  const largest = Math.max(0.01, ...data.byKind.map((group) => Math.abs(group.net)));
  return (
    <div className="trows">
      {data.byKind.map((group) => (
        <div key={group.kind} className="trow">
          <span>{KIND_PLURAL[group.kind]}</span>
          <div className="ttrack">
            <i className={group.net >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.max(2, (Math.abs(group.net) / largest) * 100)}%` }} />
          </div>
          <span className={`n pl ${group.net >= 0 ? 'pos' : 'neg'}`}>{formatSignedMoney(group.net)}</span>
        </div>
      ))}
    </div>
  );
}
