import { Fragment, useEffect, useLayoutEffect, useRef, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { totalRows, type SheetRow, type Sort } from '../../domain/listFilters';
import { formatDate, formatDays, formatMoney, formatPercent, formatSignedMoney, plural } from '../format';
import type { Entry, Selection } from '../useSelection';
import { HoverCardProvider } from './HoverCard';
import { isAfter, signClass, SortHeader } from './shared';

import { Estimate, FloatCell, ItemCell, MarketPrices, NetCell, PROFIT_BAR_LIMIT, ProfitPercent, type FlipPricing } from './SheetCells';
import { RollingNumber } from './RollingNumber';
import { TradeDetails } from './TradeInspector';
import { ENTRY_MARKS, tradeOutcome, useOutcomeEntry } from './useOutcomeEntry';

export type RowDetail = 'compact' | 'detailed';

export type { FlipPricing } from './SheetCells';
export { TradeInspector } from './TradeInspector';

interface Props {
  /** The rows on this page. */
  rows: SheetRow[];
  /** Every row that passed the filters; the totals cover all of them, not just this page. */
  allRows: SheetRow[];
  hasSales: boolean;
  expandedKey?: string;
  detailsTrigger: RefObject<HTMLButtonElement>;
  detailsId: string;
  inlineDetails: boolean;
  onToggleDetails: (key: string, fromButton?: boolean) => void;
  detail: RowDetail;
  showMarketPrices: boolean;
  sort: Sort;
  onSort: (sort: Sort) => void;
  selection: Selection;
  /** Trades after this get a "New" tag. */
  newSince?: string;
  flipPricing?: FlipPricing;
  empty: ReactNode;
  onRowMenu: (event: MouseEvent, row: SheetRow) => void;
  onRowDrag: (event: DragEvent, row: SheetRow) => void;
  onPickBuy: () => void;
}

export const rowEntry = (row: SheetRow): Entry => ({ key: row.key, tradeIds: row.tradeIds });

const HOLD_MS = 450;
const HOLD_SLOP = 8;
const isControl = (target: EventTarget) => target instanceof Element && Boolean(target.closest('button, a, input'));

export function SheetTable({ rows, allRows, hasSales, expandedKey, detailsTrigger, detailsId, inlineDetails, onToggleDetails, detail, showMarketPrices, sort, onSort, selection, newSince, flipPricing, empty, onRowMenu, onRowDrag, onPickBuy }: Props) {
  const detailed = detail === 'detailed';
  const table = useRef<HTMLTableElement>(null);
  const { entry: outcomeEntry, finish: finishOutcomeEntry } = useOutcomeEntry(table, rows);
  const hold = useRef<{ pointer: number; x: number; y: number; timer: ReturnType<typeof setTimeout> }>();
  const suppressClick = useRef(false);
  const visible = rows.map(rowEntry);
  const closedRows = allRows.filter((row) => row.status === 'closed');
  const saleRows = allRows.filter((row) => row.status === 'sale');
  const pricedRows = showMarketPrices ? allRows.filter((row) => row.quote !== undefined) : [];
  const summaryRows = closedRows.length ? closedRows : saleRows.length ? saleRows : pricedRows.length ? pricedRows : allRows;
  const totals = totalRows(summaryRows);
  const summaryLabel = closedRows.length
    ? `${closedRows.length} closed`
    : saleRows.length
      ? plural(saleRows.length, 'unpaired sale')
      : pricedRows.length
        ? `${pricedRows.length} priced`
        : plural(allRows.length, 'row');
  const summaryScope = summaryRows.length < allRows.length ? ` of ${plural(allRows.length, 'row')}` : '';
  const header = { sort, onSort };
  // A listing alone doesn't add the price columns; on sheets without them it shows in the Net column.
  const showNet = !showMarketPrices || hasSales;
  const leadingColumns = 4 + Number(hasSales) + Number(showMarketPrices);
  const columnCount = leadingColumns + 1 + (hasSales ? 3 : 0) + (showMarketPrices ? 2 : 0) + Number(showNet);
  const metricColumns = columnCount - (hasSales ? 4 : 3);

  const cancelHold = (pointer?: number) => {
    const pending = hold.current;
    if (!pending || (pointer !== undefined && pointer !== pending.pointer)) return;
    clearTimeout(pending.timer);
    hold.current = undefined;
  };
  useEffect(() => () => cancelHold(), []);

  const startHold = (event: PointerEvent, entry: Entry) => {
    if (!event.isPrimary || event.button !== 0 || isControl(event.target)) return;
    if (selection.count || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const timer = setTimeout(() => {
      hold.current = undefined;
      suppressClick.current = true;
      selection.click(entry, { add: true, range: false }, visible);
    }, HOLD_MS);
    hold.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, timer };
  };

  const movePointer = (event: PointerEvent) => {
    const pending = hold.current;
    if (pending && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > HOLD_SLOP) {
      cancelHold(event.pointerId);
    }
  };
  return (
    <HoverCardProvider>
    <table
      ref={table}
      className="sheet"
      style={{ '--metric-columns': metricColumns } as CSSProperties}
      onPointerDownCapture={(event) => {
        if (!event.isPrimary) return;
        cancelHold();
        suppressClick.current = false;
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current || event.detail === 0) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <thead>
        <tr>
          <th className="chk"><PageCheck visible={visible} selection={selection} /></th>
          <SortHeader label="Bought" sortKey="bought" numeric {...header} />
          {hasSales && <SortHeader label="Sold" sortKey="sold" numeric {...header} />}
          <SortHeader label="Item" sortKey="name" {...header} />
          <SortHeader label="Float" sortKey="float" numeric {...header} />
          {showMarketPrices && <SortHeader label="Days held" sortKey="held" numeric {...header} />}
          <SortHeader label="Buy" sortKey="buyPrice" numeric {...header} />
          {showMarketPrices && (
            <>
              <SortHeader label="Market prices" sortKey="nowPrice" numeric title="Sort by lowest CSFloat listing price" {...header} />
              <SortHeader label="If sold now" sortKey="nowNet" numeric title="Estimated profit at that price after fees" {...header} />
            </>
          )}
          {hasSales && (
            <>
              <SortHeader label="Sell" sortKey="sellPrice" numeric {...header} />
              <th className="n" scope="col">Fee</th>
            </>
          )}
          {showNet && <SortHeader label="Net profit" sortKey="net" numeric {...header} />}
          {hasSales && <SortHeader label="Profit %" sortKey="percent" numeric title={detailed ? `Bars fill at a gain or loss of ${PROFIT_BAR_LIMIT}%` : undefined} {...header} />}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columnCount} className="empty">{empty}</td>
          </tr>
        )}
        {rows.map((row, index) => {
          const entry = visible[index];
          const selected = selection.has(row.key);
          const expanded = expandedKey === row.key;
          const outcome = tradeOutcome(row);
          const entryAnimation = outcome ? outcomeEntry?.byKey.get(row.key) : undefined;
          const isNew = isAfter(row.boughtAt, newSince) || isAfter(row.soldAt, newSince);
          const clickRow = (event: MouseEvent) => {
            if (isControl(event.target)) return;
            const add = event.ctrlKey || event.metaKey;
            if (selection.count || add || event.shiftKey) {
              selection.click(entry, { add: add || !event.shiftKey, range: event.shiftKey }, visible);
            } else {
              onToggleDetails(row.key);
            }
          };
          return (
            <Fragment key={row.key}>
              <tr
                className={`row ${row.status} ${selected ? 'sel' : ''} ${expanded ? 'expanded' : ''}`}
                aria-selected={selected}
                data-outcome={outcome}
                data-outcome-entry={entryAnimation ? true : undefined}
                style={entryAnimation ? { '--entry-delay': `${entryAnimation.delay}ms` } as CSSProperties : undefined}
                onAnimationEnd={row.key === outcomeEntry?.last ? (event) => {
                  if (event.animationName === 'outcome-light') finishOutcomeEntry();
                } : undefined}
                draggable
                onPointerDown={(event) => startHold(event, entry)}
                onPointerMove={movePointer}
                onPointerUp={(event) => cancelHold(event.pointerId)}
                onPointerCancel={(event) => cancelHold(event.pointerId)}
                onPointerLeave={(event) => cancelHold(event.pointerId)}
                onDragStart={(event) => {
                  cancelHold();
                  if (suppressClick.current) event.preventDefault();
                  else if (!isControl(event.target)) onRowDrag(event, row);
                }}
                onContextMenu={(event) => {
                  if (isControl(event.target)) return;
                  const native = event.nativeEvent;
                  if ('pointerType' in native && (native.pointerType === 'touch' || native.pointerType === 'pen')) {
                    event.preventDefault();
                    return;
                  }
                  cancelHold();
                  onRowMenu(event, row);
                }}
                // Shift-click would otherwise also select the text between the two rows.
                onMouseDown={(event) => event.shiftKey && event.preventDefault()}
                onClick={clickRow}
              >
                <td className="chk">
                  {entryAnimation && (
                    <span className="outcome-ascii" aria-hidden="true">
                      {ENTRY_MARKS.map((column) => (
                        <span key={column}>
                          {Array.from({ length: detailed ? entryAnimation.lines : column.length }, (_, index) => (
                            <span key={index}>{column[index % column.length]}</span>
                          ))}
                        </span>
                      ))}
                    </span>
                  )}
                  <input type="checkbox" checked={selected} onChange={() => selection.click(entry, { add: true, range: false }, visible)} aria-label={`Select ${row.item.marketHashName}`} title="Select row" />
                </td>
                <td className="n m">{formatDate(row.boughtAt) || <span title="No buy on record">—</span>}</td>
                {hasSales && <td className="n m">{formatDate(row.soldAt) ||
                  <span title={row.status === 'open' ? 'Not sold' : 'No sale date on record'}>—</span>}</td>}
                <td>
                  <div className="item-with-disclosure">
                    <button className="row-disclosure" ref={expanded ? detailsTrigger : undefined} title={expanded ? 'Close trade details' : 'Open trade details'}
                      aria-label={`Details for ${row.item.marketHashName}`} aria-expanded={expanded}
                      aria-controls={expanded || !inlineDetails ? detailsId : undefined} onClick={() => onToggleDetails(row.key, true)}>
                      <span aria-hidden="true">›</span>
                    </button>
                    <ItemCell row={row} detailed={detailed} isNew={isNew} pricing={row.status === 'open' && !showMarketPrices ? flipPricing : undefined} />
                  </div>
                </td>
                <td className="n m"><FloatCell item={row.item} detailed={detailed} /></td>
                {showMarketPrices && <td className="n m">{formatDays(row.held)}</td>}
                <td className="n">{formatMoney(row.buyPrice)}</td>
                {showMarketPrices && (
                  <>
                    <td className="n">{row.status === 'open' && <MarketPrices item={row.item} quote={row.marketQuote}
                      onCheck={flipPricing && (() => flipPricing.onPrice(row))} busy={flipPricing?.active === row.key} disabled={flipPricing?.blocked} />}</td>
                    <td className="n pl">
                      {row.quote && <Estimate quote={row.quote} signed={row.quote.net}>{formatSignedMoney(row.quote.net)}</Estimate>}
                    </td>
                  </>
                )}
                {hasSales && (
                  <>
                    <td className="n">{formatMoney(row.sellPrice)}</td>
                    <td className="n m">{formatMoney(row.fee)}</td>
                  </>
                )}
                {showNet && <td className={`n pl ${signClass(row.net)}`}><NetCell row={row} onPickBuy={onPickBuy} /></td>}
                {hasSales && (
                  <td className="n">
                    {row.percent !== undefined && <ProfitPercent percent={row.percent} detailed={detailed} />}
                  </td>
                )}
              </tr>
              {expanded && inlineDetails && (
                <tr className="trade-detail-row" id={detailsId}>
                  <td colSpan={columnCount}><TradeDetails row={row} /></td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={leadingColumns}>{summaryLabel}{summaryScope && <span className="m">{summaryScope}</span>}</td>
          <td className="n">{formatMoney(totals.buy)}</td>
          {showMarketPrices && (
            <>
              <td className="n est">{formatMoney(totals.nowPrice)}</td>
              <td className={`n pl est ${signClass(totals.nowNet)}`} title={totals.nowPercent === undefined ? undefined :
                `Estimated profit: ${formatPercent(totals.nowPercent)}`}>
                {totals.nowNet === undefined ? '' : formatSignedMoney(totals.nowNet)}
              </td>
            </>
          )}
          {hasSales && (
            <>
              <td className="n">{formatMoney(totals.sell)}</td>
              <td className="n m">{formatMoney(totals.fee)}</td>
            </>
          )}
          {showNet && <td className={`n pl ${signClass(totals.net)}`}>{totals.net === undefined ? '' : formatSignedMoney(totals.net)}</td>}
          {hasSales && (
            <td className={`n pl ${signClass(totals.weightedPercent)}`} title="Weighted profit over the cost of closed flips">
              {totals.weightedPercent === undefined ? '' : formatPercent(totals.weightedPercent)}
            </td>
          )}
        </tr>
      </tfoot>
    </table>
    </HoverCardProvider>
  );
}

/** Selects or clears every row on this page. */
function PageCheck({ visible, selection }: { visible: Entry[]; selection: Selection }) {
  const selectedCount = visible.filter((entry) => selection.has(entry.key)).length;
  const all = visible.length > 0 && selectedCount === visible.length;
  const partial = selectedCount > 0 && !all;
  const action = all ? 'Deselect every row on this page' : partial ? 'Select remaining rows on this page' : 'Select every row on this page';
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return (
    <input ref={ref} type="checkbox" checked={all} onChange={() => selection.setAll(visible, !all)} aria-label={action} title={action} />
  );
}
