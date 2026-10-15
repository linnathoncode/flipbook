import { lockManualMatch } from '../../app/actions';
import type { UnmatchedEntry } from '../../domain/journal';
import { centsToDollars } from '../../domain/profit';
import { formatFloat, formatIsoDate, formatMoney } from '../format';
import { entryKey } from '../places';
import type { Entry, Selection } from '../useSelection';
import { EmptyState, itemLabel, ItemName, RowCheck, SelectAllCheck, selectableRow } from './shared';

interface Props {
  unmatched: UnmatchedEntry[];
  selection: Selection;
  onChange: () => void;
}

function saleEntry(entry: UnmatchedEntry): Entry {
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
              <ItemName trade={sell} />
              <span className="mono">Sold {formatIsoDate(sell.at)} for {formatMoney(centsToDollars(sell.priceCents))}</span>
            </div>
            <div className="candidates">
              {candidates.map((buy) => (
                <button key={buy.id} className="button" onClick={() => choose(sell.id, buy.id)}>
                  <span className="mono">{formatMoney(centsToDollars(buy.priceCents))}</span>
                  <span>bought {formatIsoDate(buy.at)}</span>
                  {buy.item.floatValue !== undefined && <span className="mono muted">{formatFloat(buy.item.floatValue)}</span>}
                </button>
              ))}
            </div>
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
        Bought outside CSFloat or before your history starts. Select them and move them to a folder to keep the book clean.
      </p>
      <div className="sheet-scroll">
        <table className="sheet">
          <thead>
            <tr>
              <th className="check-cell"><SelectAllCheck visible={visible} selection={selection} /></th>
              <th>Sold</th>
              <th>Skin name</th>
              <th className="num">Float</th>
              <th className="num">Sell price</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ sell }, index) => {
              const entry = visible[index];
              return (
                <tr key={entry.key} {...selectableRow(entry, visible, selection)}>
                  <td className="check-cell">
                    <RowCheck entry={entry} visible={visible} selection={selection} label={itemLabel(sell)} />
                  </td>
                  <td className="mono">{formatIsoDate(sell.at)}</td>
                  <td><ItemName trade={sell} /></td>
                  <td className="num mono muted">{formatFloat(sell.item.floatValue)}</td>
                  <td className="num mono">{formatMoney(centsToDollars(sell.priceCents))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
