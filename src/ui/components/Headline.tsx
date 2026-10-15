import type { ProfitSummary } from '../../domain/profit';
import { formatMoney, formatPercent, formatSignedMoney } from '../format';
import { signClass } from './shared';

/** The page's bottom line, written as one sentence rather than a row of stat tiles. */
export function FlipHeadline({ summary, filtered }: { summary: ProfitSummary; filtered: boolean }) {
  const scope = filtered ? ' matching your filters' : '';
  if (summary.flipCount === 0) return <p className="headline">No settled flips{scope}.</p>;
  return (
    <p className="headline">
      <Figure text={String(summary.flipCount)} /> settled flips{scope},{' '}
      <Figure value={summary.totalProfit} text={formatSignedMoney(summary.totalProfit)} /> net.{' '}
      <Figure value={summary.averagePercent} text={formatPercent(summary.averagePercent)} /> per flip on average,{' '}
      <Figure value={summary.weightedAveragePercent} text={formatPercent(summary.weightedAveragePercent)} /> weighted by cost.
    </p>
  );
}

export function HoldingHeadline({ count, totalCost }: { count: number; totalCost: number }) {
  return (
    <p className="headline">
      <Figure text={String(count)} /> items in hand, <Figure text={formatMoney(totalCost)} /> at cost.
    </p>
  );
}

export function PlainHeadline({ text }: { text: string }) {
  return <p className="headline">{text}</p>;
}

function Figure({ text, value }: { text: string; value?: number }) {
  return <strong className={`figure ${value === undefined ? '' : signClass(value)}`}>{text}</strong>;
}
