import { releaseManualMatch } from '../../app/actions';
import type { FlipSortKey, Sort } from '../../domain/listFilters';
import { heldDays, summarize, type Flip } from '../../domain/profit';
import type { MatchConfidence } from '../../domain/types';
import { formatDays, formatFloat, formatIsoDate, formatMoney, formatPercent, formatSignedMoney } from '../format';
import type { Selection } from '../useSelection';
import { CONFIDENCE, flipEntry } from './flipRows';
import { isAfter, itemLabel, ItemName, RowCheck, SelectAllCheck, selectableRow, signClass, SortHeader } from './shared';

const UNLINKABLE: ReadonlySet<MatchConfidence> = new Set(['manual', 'tracker']);

interface Props {
  flips: Flip[];
  sort: Sort<FlipSortKey>;
  onSort: (sort: Sort<FlipSortKey>) => void;
  selection: Selection;
  /** Sales after this time get a NEW tag. */
  newSince?: string;
  onChange: () => void;
}

/** The book as a spreadsheet: one line per flip, the user's own tracker columns, totals at the bottom. */
export function FlipSheet({ flips, sort, onSort, selection, newSince, onChange }: Props) {
  const visible = flips.map(flipEntry);
  const header = { sort, onSort };
  const totals = summarize(flips);
  const total = (pick: (flip: Flip) => number) => flips.reduce((sum, flip) => sum + pick(flip), 0);

  const unlink = async (sellId: string) => {
    await releaseManualMatch(sellId);
    onChange();
  };

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
            <SortHeader label="Sold" sortKey="sold" {...header} />
            <SortHeader label="Sell price" sortKey="sellPrice" className="num" {...header} />
            <th className="num">Fees</th>
            <SortHeader label="Net profit" sortKey="net" className="num" {...header} />
            <SortHeader label="Profit %" sortKey="percent" className="num" {...header} />
            <SortHeader label="Held" sortKey="held" className="num" {...header} />
            <th>Match</th>
          </tr>
        </thead>
        <tbody>
          {flips.map((flip, index) => {
            const entry = visible[index];
            const confidence = CONFIDENCE[flip.match.confidence];
            const sellDated = flip.sell.source !== 'xlsx';
            return (
              <tr key={entry.key} {...selectableRow(entry, visible, selection)}>
                <td className="check-cell">
                  <RowCheck entry={entry} visible={visible} selection={selection} label={itemLabel(flip.buy)} />
                </td>
                <td className="mono">{formatIsoDate(flip.buy.at)}</td>
                <td><ItemName trade={flip.sell} isNew={sellDated && isAfter(flip.sell.at, newSince)} /></td>
                <td className="num mono muted">{formatFloat(flip.buy.item.floatValue)}</td>
                <td className="num mono">{formatMoney(flip.buyPrice)}</td>
                <td className="mono muted">{sellDated ? formatIsoDate(flip.sell.at) : ''}</td>
                <td className="num mono">{formatMoney(flip.sellPrice)}</td>
                <td className="num mono muted">{formatMoney(flip.fee)}</td>
                <td className={`num mono strong ${signClass(flip.netProfit)}`}>{formatSignedMoney(flip.netProfit)}</td>
                <td className={`num mono ${signClass(flip.profitPercent)}`}>{formatPercent(flip.profitPercent)}</td>
                <td className="num mono muted">{formatDays(heldDays(flip))}</td>
                <td className="match">
                  <span title={confidence.hint}>{confidence.label}</span>
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
        <tfoot>
          <tr>
            <td />
            <td colSpan={3}>{flips.length === 1 ? '1 flip' : `${flips.length} flips`}</td>
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
