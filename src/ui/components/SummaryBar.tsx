import type { ProfitSummary } from '../../domain/profit';
import { formatPercent, formatSignedMoney } from '../format';
import { signClass } from './shared';

/** The book's bottom line, written as one sentence rather than a row of stat tiles. */
export function SummaryBar({ summary }: { summary: ProfitSummary }) {
  if (summary.flipCount === 0) {
    return <p className="ledger-line">No settled flips yet.</p>;
  }
  return (
    <p className="ledger-line">
      <Figure value={summary.flipCount} text={String(summary.flipCount)} /> settled flips,{' '}
      <Figure value={summary.totalProfit} text={formatSignedMoney(summary.totalProfit)} signed /> net.{' '}
      <Figure value={summary.averagePercent} text={formatPercent(summary.averagePercent)} signed /> per flip on average,{' '}
      <Figure value={summary.weightedAveragePercent} text={formatPercent(summary.weightedAveragePercent)} signed /> weighted by cost.
    </p>
  );
}

function Figure({ value, text, signed = false }: { value: number; text: string; signed?: boolean }) {
  return <strong className={`figure ${signed ? signClass(value) : ''}`}>{text}</strong>;
}
