import { lockManualMatch } from '../../app/actions';
import type { UnmatchedEntry } from '../../domain/journal';
import { centsToDollars } from '../../domain/profit';
import { formatDate, formatFloat, formatMoney } from '../format';
import { entryKey } from '../places';
import type { Entry, Selection } from '../useSelection';
import { ItemCell } from './ItemCell';
import { EmptyState, RowCheck, SelectAllCheck } from './shared';

interface Props {
  unmatched: UnmatchedEntry[];
  selection: Selection;
  onChange: () => void;
}

export function saleEntry(entry: UnmatchedEntry): Entry {
  return { key: entryKey.sale(entry.sell.id), tradeIds: [entry.sell.id] };
}

export function ReviewPanel({ unmatched, selection, onChange }: Props) {
  if (unmatched.length === 0) return <EmptyState text="Nothing to review. Every sale is paired with its buy." />;

  const ambiguous = unmatched.filter((entry) => entry.reason === 'ambiguous');
  const orphans = unmatched.filter((entry) => entry.reason === 'no-candidate');

  return (
    <div className="review">
      {ambiguous.length > 0 && <PickBuy entries={ambiguous} onChange={onChange} />}
      {orphans.length > 0 && <SoldWithoutBuy entries={orphans} selection={selection} />}
    </div>
  );
}

function PickBuy({ entries, onChange }: { entries: UnmatchedEntry[]; onChange: () => void }) {
  const choose = async (sellId: string, buyId: string) => {
    await lockManualMatch(sellId, buyId);
    onChange();
  };

  return (
    <section>
      <h2 className="section-title">Pick the buy</h2>
      <p className="section-hint">More than one buy could be the item you sold. Choose the right one.</p>
      <ul className="review-list">
        {entries.map(({ sell, candidates }) => (
          <li key={sell.id} className="review-item">
            <div className="review-sell">
              <ItemCell trade={sell} />
              <span className="side">
                <span className="price">{formatMoney(centsToDollars(sell.priceCents))}</span>
                <span className="when">Sold {formatDate(sell.at)}</span>
              </span>
            </div>
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
    </section>
  );
}

function SoldWithoutBuy({ entries, selection }: { entries: UnmatchedEntry[]; selection: Selection }) {
  const visible = entries.map(saleEntry);
  return (
    <section>
      <h2 className="section-title">Sold with no buy on record</h2>
      <p className="section-hint">
        These were bought outside CSFloat or before your history starts. Import your spreadsheet to pair them,
        or select them and move them to a folder.
      </p>
      <table className="ledger is-compact">
        <thead>
          <tr>
            <th className="check-cell"><SelectAllCheck visible={visible} selection={selection} /></th>
            <th>Item</th>
            <th className="side">Sold</th>
            <th className="num">Price</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ sell }, index) => (
            <tr key={sell.id} className={selection.has(visible[index].key) ? 'is-selected' : ''}>
              <td className="check-cell">
                <RowCheck entry={visible[index]} visible={visible} selection={selection} label={sell.item.marketHashName} />
              </td>
              <td><ItemCell trade={sell} compact /></td>
              <td className="side"><span className="when">{formatDate(sell.at)}</span></td>
              <td className="num"><span className="price">{formatMoney(centsToDollars(sell.priceCents))}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
