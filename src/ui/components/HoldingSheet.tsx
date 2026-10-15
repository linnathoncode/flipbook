import type { HoldingSortKey, Sort } from '../../domain/listFilters';
import { centsToDollars } from '../../domain/profit';
import type { Trade } from '../../domain/types';
import { formatDays, formatFloat, formatIsoDate, formatMoney } from '../format';
import { entryKey } from '../places';
import type { Entry, Selection } from '../useSelection';
import { isAfter, itemLabel, ItemName, RowCheck, SelectAllCheck, selectableRow, SortHeader } from './shared';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  buys: Trade[];
  sort: Sort<HoldingSortKey>;
  onSort: (sort: Sort<HoldingSortKey>) => void;
  selection: Selection;
  newSince?: string;
}

function holdingEntry(buy: Trade): Entry {
  return { key: entryKey.holding(buy.id), tradeIds: [buy.id] };
}

/** Bought and not sold yet. */
export function HoldingSheet({ buys, sort, onSort, selection, newSince }: Props) {
  const visible = buys.map(holdingEntry);
  const header = { sort, onSort };
  const totalCost = centsToDollars(buys.reduce((sum, buy) => sum + buy.priceCents, 0));
  const now = Date.now();

  return (
    <div className="sheet-scroll">
      <table className="sheet">
        <thead>
          <tr>
            <th className="check-cell"><SelectAllCheck visible={visible} selection={selection} /></th>
            <SortHeader label="Buy date" sortKey="bought" {...header} />
            <SortHeader label="Skin name" sortKey="name" {...header} />
            <th className="num">Float</th>
            <SortHeader label="Buy price" sortKey="buyPrice" className="num" {...header} />
            <th className="num">Held</th>
          </tr>
        </thead>
        <tbody>
          {buys.map((buy, index) => {
            const entry = visible[index];
            return (
              <tr key={entry.key} {...selectableRow(entry, visible, selection)}>
                <td className="check-cell">
                  <RowCheck entry={entry} visible={visible} selection={selection} label={itemLabel(buy)} />
                </td>
                <td className="mono">{formatIsoDate(buy.at)}</td>
                <td><ItemName trade={buy} isNew={isAfter(buy.at, newSince)} /></td>
                <td className="num mono muted">{formatFloat(buy.item.floatValue)}</td>
                <td className="num mono">{formatMoney(centsToDollars(buy.priceCents))}</td>
                <td className="num mono muted">{formatDays(Math.floor((now - Date.parse(buy.at)) / DAY_MS))}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td colSpan={3}>{buys.length === 1 ? '1 item' : `${buys.length} items`}</td>
            <td className="num mono">{formatMoney(totalCost)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
