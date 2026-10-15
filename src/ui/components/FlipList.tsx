import { releaseManualMatch } from '../../app/actions';
import { heldDays } from '../../domain/profit';
import type { MatchConfidence } from '../../domain/types';
import { formatDate, formatDays, formatMoney, formatPercent, formatSignedMoney } from '../format';
import { FlipSheet } from './FlipSheet';
import { CONFIDENCE, flipEntry, type FlipListProps } from './flipRows';
import { ItemCell } from './ItemCell';
import { RowCheck, SelectAllCheck, signClass, SortHeader } from './shared';

const UNLINKABLE: ReadonlySet<MatchConfidence> = new Set(['manual', 'tracker']);

export function FlipList(props: FlipListProps) {
  if (props.mode === 'sheet') return <FlipSheet {...props} />;
  return <FlipLedger {...props} />;
}

function FlipLedger({ flips, mode, sort, onSort, selection, onChange }: FlipListProps) {
  const visible = flips.map(flipEntry);
  const header = { sort, onSort };

  const unlink = async (sellId: string) => {
    await releaseManualMatch(sellId);
    onChange();
  };

  return (
    <table className={`ledger ${mode === 'compact' ? 'is-compact' : ''}`}>
      <thead>
        <tr>
          <th className="check-cell"><SelectAllCheck visible={visible} selection={selection} /></th>
          <SortHeader label="Item" sortKey="name" {...header} />
          <SortHeader label="Bought" sortKey="bought" className="side" {...header} />
          <th className="fold" aria-hidden="true" />
          <SortHeader label="Sold" sortKey="sold" className="side" {...header} />
          <SortHeader label="Held" sortKey="held" className="num" {...header} />
          <th className="num">Fee</th>
          <SortHeader label="Net" sortKey="net" className="num" {...header} />
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        {flips.map((flip, index) => {
          const confidence = CONFIDENCE[flip.match.confidence];
          const entry = visible[index];
          return (
            <tr key={entry.key} className={selection.has(entry.key) ? 'is-selected' : ''}>
              <td className="check-cell">
                <RowCheck entry={entry} visible={visible} selection={selection} label={flip.buy.item.marketHashName} />
              </td>
              <td><ItemCell trade={flip.buy} compact={mode === 'compact'} /></td>
              <td className="side">
                <span className="price">{formatMoney(flip.buyPrice)}</span>
                <span className="when">{formatDate(flip.buy.at)}</span>
              </td>
              <td className="fold" aria-hidden="true" />
              <td className="side">
                <span className="price">{formatMoney(flip.sellPrice)}</span>
                <span className="when">{flip.sell.source === 'xlsx' ? 'Date not recorded' : formatDate(flip.sell.at)}</span>
              </td>
              <td className="num muted mono">{formatDays(heldDays(flip))}</td>
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
                  <button className="text-button" onClick={() => unlink(flip.sell.id)} title="Let Flipbook match this sale again">
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
