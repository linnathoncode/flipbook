import { releaseManualMatch } from '../../app/actions';
import type { Flip } from '../../domain/profit';
import type { MatchConfidence } from '../../domain/types';
import { formatDate, formatMoney, formatPercent } from '../format';
import { ItemCell } from './ItemCell';
import { EmptyState, signClass } from './shared';

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  exact: 'exact',
  fifo: 'FIFO',
  suggested: 'check',
  tracker: 'tracker',
  manual: 'manual',
};

const RELEASABLE: ReadonlySet<MatchConfidence> = new Set(['manual', 'tracker']);

interface Props {
  flips: Flip[];
  onChange: () => void;
}

export function FlipsTable({ flips, onChange }: Props) {
  if (flips.length === 0) return <EmptyState text="No flips yet. Sync or import trades from the Import tab." />;

  const release = async (sellId: string) => {
    await releaseManualMatch(sellId);
    onChange();
  };

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Bought</th>
          <th>Sold</th>
          <th className="num">Buy</th>
          <th className="num">Sell</th>
          <th className="num">Fee</th>
          <th className="num">Net</th>
          <th className="num">%</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        {flips.map((flip) => (
          <tr key={flip.sell.id}>
            <td><ItemCell trade={flip.buy} /></td>
            <td>{formatDate(flip.buy.at)}</td>
            <td>{flip.sell.source === 'xlsx' ? '—' : formatDate(flip.sell.at)}</td>
            <td className="num">{formatMoney(flip.buyPrice)}</td>
            <td className="num">{formatMoney(flip.sellPrice)}</td>
            <td className="num muted">{formatMoney(flip.fee)}</td>
            <td className={`num ${signClass(flip.netProfit)}`}>{formatMoney(flip.netProfit)}</td>
            <td className={`num ${signClass(flip.profitPercent)}`}>{formatPercent(flip.profitPercent)}</td>
            <td>
              <span className={`badge ${flip.match.confidence}`}>{CONFIDENCE_LABEL[flip.match.confidence]}</span>
              {RELEASABLE.has(flip.match.confidence) && (
                <button className="link" onClick={() => release(flip.sell.id)} title="Let the matcher decide again">
                  unlink
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
