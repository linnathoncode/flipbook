import { trackerDisplayName } from '../../domain/itemNames';
import { heldDays, summarize, type Flip } from '../../domain/profit';
import { formatDays, formatFloat, formatIsoDate, formatMoney, formatPercent, formatSignedMoney } from '../format';
import { rarityColor } from '../rarity';
import { CONFIDENCE, flipEntry, type FlipListProps } from './flipRows';
import { RowCheck, SelectAllCheck, signClass, SortHeader } from './shared';

/** Spreadsheet layout: one line per flip, every value in its own column, totals at the bottom. */
export function FlipSheet({ flips, sort, onSort, selection }: FlipListProps) {
  const visible = flips.map(flipEntry);
  const header = { sort, onSort };
  const totals = summarize(flips);
  const total = (pick: (flip: Flip) => number) => flips.reduce((sum, flip) => sum + pick(flip), 0);

  return (
    <div className="sheet-scroll">
      <table className="sheet">
        <thead>
          <tr>
            <th className="check-cell"><SelectAllCheck visible={visible} selection={selection} /></th>
            <SortHeader label="Bought" sortKey="bought" {...header} />
            <SortHeader label="Item" sortKey="name" {...header} />
            <th className="num">Float</th>
            <th className="num">Seed</th>
            <SortHeader label="Buy" sortKey="buyPrice" className="num" {...header} />
            <SortHeader label="Sold" sortKey="sold" {...header} />
            <SortHeader label="Sell" sortKey="sellPrice" className="num" {...header} />
            <th className="num">Fee</th>
            <SortHeader label="Net" sortKey="net" className="num" {...header} />
            <SortHeader label="%" sortKey="percent" className="num" {...header} />
            <SortHeader label="Held" sortKey="held" className="num" {...header} />
            <th>Match</th>
          </tr>
        </thead>
        <tbody>
          {flips.map((flip, index) => {
            const entry = visible[index];
            const { item } = flip.buy;
            return (
              <tr key={entry.key} className={selection.has(entry.key) ? 'is-selected' : ''}>
                <td className="check-cell">
                  <RowCheck entry={entry} visible={visible} selection={selection} label={item.marketHashName} />
                </td>
                <td className="mono">{formatIsoDate(flip.buy.at)}</td>
                <td className="sheet-name" style={{ borderLeftColor: rarityColor(item) ?? 'transparent' }}>
                  {flip.buy.source === 'xlsx' ? item.itemName : trackerDisplayName(item)}
                </td>
                <td className="num mono">{formatFloat(item.floatValue)}</td>
                <td className="num mono">{item.paintSeed ?? ''}</td>
                <td className="num mono">{formatMoney(flip.buyPrice)}</td>
                <td className="mono">{flip.sell.source === 'xlsx' ? '' : formatIsoDate(flip.sell.at)}</td>
                <td className="num mono">{formatMoney(flip.sellPrice)}</td>
                <td className="num mono muted">{formatMoney(flip.fee)}</td>
                <td className={`num mono ${signClass(flip.netProfit)}`}>{formatSignedMoney(flip.netProfit)}</td>
                <td className={`num mono ${signClass(flip.profitPercent)}`}>{formatPercent(flip.profitPercent)}</td>
                <td className="num mono muted">{formatDays(heldDays(flip))}</td>
                <td className="muted">{CONFIDENCE[flip.match.confidence].label}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td colSpan={4}>{flips.length} flips</td>
            <td className="num mono">{formatMoney(total((flip) => flip.buyPrice))}</td>
            <td />
            <td className="num mono">{formatMoney(total((flip) => flip.sellPrice))}</td>
            <td className="num mono">{formatMoney(total((flip) => flip.fee))}</td>
            <td className={`num mono ${signClass(totals.totalProfit)}`}>{formatSignedMoney(totals.totalProfit)}</td>
            <td className={`num mono ${signClass(totals.weightedAveragePercent)}`} title="Weighted by buy price">
              {formatPercent(totals.weightedAveragePercent)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
