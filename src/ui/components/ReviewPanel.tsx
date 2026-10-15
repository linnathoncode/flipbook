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
  ambiguous: 'Several buys could be this item. Pick the right one.',
  'no-candidate': 'No earlier buy found. It was probably bought before your history starts, or elsewhere.',
} as const;

export function ReviewPanel({ unmatched, onChange }: Props) {
  if (unmatched.length === 0) return <EmptyState text="Every sell is matched to a buy." />;

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
            <span>
              sold {formatDate(sell.at)} for <strong>{formatMoney(centsToDollars(sell.priceCents))}</strong>
            </span>
          </div>
          <p className="muted small">{REASON_TEXT[reason]}</p>
          {candidates.map((buy) => (
            <button key={buy.id} className="candidate" onClick={() => choose(sell.id, buy.id)}>
              {formatDate(buy.at)} · {formatMoney(centsToDollars(buy.priceCents))} · float {formatFloat(buy.item.floatValue)}
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}
