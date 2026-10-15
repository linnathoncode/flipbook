import { lockManualMatch } from '../../app/actions';
import type { JournalView } from '../../domain/journal';
import { centsToDollars } from '../../domain/profit';
import { formatDate, formatFloat, formatMoney } from '../format';
import { EmptyState } from './shared';
import { ItemCell } from './ItemCell';

interface Props {
  unmatched: JournalView['unmatchedSells'];
  onChange: () => void;
}

const REASON_TEXT = {
  ambiguous: 'More than one buy could be this item. Pick the one you sold.',
  'no-candidate': 'No earlier buy of this item. It was probably bought outside CSFloat; import your spreadsheet to add it.',
} as const;

export function ReviewPanel({ unmatched, onChange }: Props) {
  if (unmatched.length === 0) return <EmptyState text="Nothing to review. Every sale is paired with its buy." />;

  const choose = async (sellId: string, buyId: string) => {
    await lockManualMatch(sellId, buyId);
    onChange();
  };

  return (
    <ul className="review">
      {unmatched.map(({ sell, candidates, reason }) => (
        <li key={sell.id} className="review-item">
          <div className="review-sell">
            <ItemCell trade={sell} />
            <span className="side">
              <span className="price">{formatMoney(centsToDollars(sell.priceCents))}</span>
              <span className="when">Sold {formatDate(sell.at)}</span>
            </span>
          </div>
          <p className="review-reason">{REASON_TEXT[reason]}</p>
          {candidates.map((buy) => (
            <button key={buy.id} className="candidate" onClick={() => choose(sell.id, buy.id)}>
              <span className="mono">{formatMoney(centsToDollars(buy.priceCents))}</span>
              <span>Bought {formatDate(buy.at)}</span>
              {buy.item.floatValue !== undefined && <span className="mono">{formatFloat(buy.item.floatValue)}</span>}
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}
