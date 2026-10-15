import { releaseManualMatch } from '../../app/actions';
import type { Flip } from '../../domain/profit';
import type { MatchConfidence } from '../../domain/types';
import { formatDate, formatMoney, formatPercent, formatSignedMoney } from '../format';
import { ItemCell } from './ItemCell';
import { EmptyState, signClass } from './shared';

const CONFIDENCE: Record<MatchConfidence, { label: string; hint: string }> = {
  exact: { label: 'Exact', hint: 'Same float, seed and pattern' },
  fifo: { label: 'FIFO', hint: 'Interchangeable item, oldest buy closed first' },
  suggested: { label: 'Check', hint: 'Only same-name buy found. Probably right, worth a look' },
  tracker: { label: 'Tracker', hint: 'Paired on a row of your spreadsheet' },
  manual: { label: 'Manual', hint: 'You chose this pairing' },
};

const UNLINKABLE: ReadonlySet<MatchConfidence> = new Set(['manual', 'tracker']);

interface Props {
  flips: Flip[];
  onChange: () => void;
}

export function FlipsTable({ flips, onChange }: Props) {
  if (flips.length === 0) {
    return <EmptyState text="No flips yet. Sync your CSFloat trades from the Data tab." />;
  }

  const unlink = async (sellId: string) => {
    await releaseManualMatch(sellId);
    onChange();
  };

  return (
    <table className="ledger">
      <thead>
        <tr>
          <th>Item</th>
          <th className="side">Bought</th>
          <th className="fold" aria-hidden="true" />
          <th className="side">Sold</th>
          <th className="num">Fee</th>
          <th className="num">Net</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        {flips.map((flip) => {
          const confidence = CONFIDENCE[flip.match.confidence];
          return (
            <tr key={flip.sell.id}>
              <td><ItemCell trade={flip.buy} /></td>
              <td className="side">
                <span className="price">{formatMoney(flip.buyPrice)}</span>
                <span className="when">{formatDate(flip.buy.at)}</span>
              </td>
              <td className="fold" aria-hidden="true" />
              <td className="side">
                <span className="price">{formatMoney(flip.sellPrice)}</span>
                <span className="when">{flip.sell.source === 'xlsx' ? 'Date not recorded' : formatDate(flip.sell.at)}</span>
              </td>
              <td className="num muted mono">{formatMoney(flip.fee)}</td>
              <td className={`num ${signClass(flip.netProfit)}`}>
                <span className="price">{formatSignedMoney(flip.netProfit)}</span>
                <span className="when">{formatPercent(flip.profitPercent)}</span>
              </td>
              <td>
                <span className={`tag tag-${flip.match.confidence}`} title={confidence.hint}>
                  {confidence.label}
                </span>
                {UNLINKABLE.has(flip.match.confidence) && (
                  <button className="text-button" onClick={() => unlink(flip.sell.id)} title="Let Flipbook match this sell again">
                    Unlink
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
