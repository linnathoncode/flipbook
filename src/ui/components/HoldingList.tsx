import { trackerDisplayName } from '../../domain/itemNames';
import type { HoldingSortKey, Sort } from '../../domain/listFilters';
import { centsToDollars } from '../../domain/profit';
import type { Trade } from '../../domain/types';
import { formatDate, formatFloat, formatIsoDate, formatMoney } from '../format';
import { entryKey, type ViewMode } from '../places';
import { rarityColor } from '../rarity';
import type { Entry, Selection } from '../useSelection';
import { ItemCell } from './ItemCell';
import { RowCheck, SelectAllCheck, SortHeader } from './shared';

interface Props {
  buys: Trade[];
  mode: ViewMode;
  sort: Sort<HoldingSortKey>;
  onSort: (sort: Sort<HoldingSortKey>) => void;
  selection: Selection;
}

export function holdingEntry(buy: Trade): Entry {
  return { key: entryKey.holding(buy.id), tradeIds: [buy.id] };
}

export function HoldingList({ buys, mode, sort, onSort, selection }: Props) {
  const visible = buys.map(holdingEntry);
  const header = { sort, onSort };
  const totalCost = centsToDollars(buys.reduce((sum, buy) => sum + buy.priceCents, 0));
  const check = (buy: Trade, index: number) => (
    <td className="check-cell">
      <RowCheck entry={visible[index]} visible={visible} selection={selection} label={buy.item.marketHashName} />
    </td>
  );
  const rowClass = (index: number) => (selection.has(visible[index].key) ? 'is-selected' : '');

  if (mode === 'sheet') {
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
              <SortHeader label="Cost" sortKey="buyPrice" className="num" {...header} />
            </tr>
          </thead>
          <tbody>
            {buys.map((buy, index) => (
              <tr key={buy.id} className={rowClass(index)}>
                {check(buy, index)}
                <td className="mono">{formatIsoDate(buy.at)}</td>
                <td className="sheet-name" style={{ borderLeftColor: rarityColor(buy.item) ?? 'transparent' }}>
                  {buy.source === 'xlsx' ? buy.item.itemName : trackerDisplayName(buy.item)}
                </td>
                <td className="num mono">{formatFloat(buy.item.floatValue)}</td>
                <td className="num mono">{buy.item.paintSeed ?? ''}</td>
                <td className="num mono">{formatMoney(centsToDollars(buy.priceCents))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td colSpan={4}>{buys.length} items</td>
              <td className="num mono">{formatMoney(totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <table className={`ledger ${mode === 'compact' ? 'is-compact' : ''}`}>
      <thead>
        <tr>
          <th className="check-cell"><SelectAllCheck visible={visible} selection={selection} /></th>
          <SortHeader label="Item" sortKey="name" {...header} />
          <SortHeader label="Bought" sortKey="bought" className="side" {...header} />
          <SortHeader label="Cost" sortKey="buyPrice" className="num" {...header} />
        </tr>
      </thead>
      <tbody>
        {buys.map((buy, index) => (
          <tr key={buy.id} className={rowClass(index)}>
            {check(buy, index)}
            <td><ItemCell trade={buy} compact={mode === 'compact'} /></td>
            <td className="side"><span className="when">{formatDate(buy.at)}</span></td>
            <td className="num"><span className="price">{formatMoney(centsToDollars(buy.priceCents))}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
