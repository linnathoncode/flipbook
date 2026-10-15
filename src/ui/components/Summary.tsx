import type { ProfitSummary } from '../../domain/profit';
import { formatMoney, formatPercent, formatSignedMoney } from '../format';
import { signClass } from './shared';

interface Figure {
  label: string;
  text: string;
  /** Colors the figure as a gain or loss. */
  value?: number;
}

/** The sheet's bottom line, in big type above it. */
export function FlipSummary({ summary, filtered }: { summary: ProfitSummary; filtered: boolean }) {
  return (
    <Figures
      note={filtered ? 'Matching your filters' : undefined}
      figures={[
        { label: 'Total profit', text: formatSignedMoney(summary.totalProfit), value: summary.totalProfit },
        { label: 'Avg profit %', text: formatPercent(summary.averagePercent), value: summary.averagePercent },
        { label: 'Weighted avg %', text: formatPercent(summary.weightedAveragePercent), value: summary.weightedAveragePercent },
        { label: 'Settled flips', text: String(summary.flipCount) },
      ]}
    />
  );
}

export function HoldingSummary({ count, totalCost }: { count: number; totalCost: number }) {
  return (
    <Figures
      figures={[
        { label: 'Items held', text: String(count) },
        { label: 'Cost basis', text: formatMoney(totalCost) },
      ]}
    />
  );
}

function Figures({ figures, note }: { figures: Figure[]; note?: string }) {
  return (
    <section className="summary" aria-label="Summary">
      {figures.map((figure) => (
        <div key={figure.label} className="figure">
          <span className="figure-label">{figure.label}</span>
          <span className={`figure-value ${figure.value === undefined ? '' : signClass(figure.value)}`}>{figure.text}</span>
        </div>
      ))}
      {note && <p className="summary-note">{note}</p>}
    </section>
  );
}
