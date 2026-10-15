import type { ProfitSummary } from '../../domain/profit';
import { formatDate, formatMoney, formatPercent } from '../format';
import { signClass } from './shared';

interface Props {
  summary: ProfitSummary;
  lastSyncAt?: string;
}

export function SummaryBar({ summary, lastSyncAt }: Props) {
  const tiles = [
    { label: 'Total profit', value: formatMoney(summary.totalProfit), sign: summary.totalProfit },
    { label: 'Avg %', value: formatPercent(summary.averagePercent), sign: summary.averagePercent },
    { label: 'Weighted avg %', value: formatPercent(summary.weightedAveragePercent), sign: summary.weightedAveragePercent },
    { label: 'Settled flips', value: String(summary.flipCount), sign: 0 },
  ];

  return (
    <section className="summary">
      {tiles.map((tile) => (
        <div key={tile.label} className="tile">
          <span className="tile-label">{tile.label}</span>
          <span className={`tile-value ${signClass(tile.sign)}`}>{tile.value}</span>
        </div>
      ))}
      <p className="muted sync-note">{lastSyncAt ? `Synced ${formatDate(lastSyncAt)}` : 'Never synced'}</p>
    </section>
  );
}
