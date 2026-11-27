import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { adjustedFloat, floatRange, type FloatRange } from '../../domain/floatRanges';
import { totalRows, type ListedFor, type PricedAt, type SheetRow, type Sort } from '../../domain/listFilters';
import { itemPriceKey, type PriceQuote } from '../../domain/prices';
import { centsToDollars } from '../../domain/profit';
import type { Item } from '../../domain/types';
import { CSFLOAT_ORIGIN } from '../../io/csfloatSync';
import { formatDate, formatDays, formatFloat, formatMoney, formatPercent, formatSignedMoney, formatTimeAgo, plural, roundTo } from '../format';
import { rarityColor } from '../rarity';
import { steamImageUrl } from '../steamImages';
import type { Entry, Selection } from '../useSelection';
import { HoverCardProvider, useHoverCard, type CardContent } from './HoverCard';
import { RollingNumber } from './RollingNumber';
import { Signal } from './Signal';
import { CONFIDENCE, isAfter, itemTitle, signClass, SortHeader } from './shared';

export type RowDetail = 'compact' | 'detailed';

export interface FlipPricing {
  active?: string;
  /** A price request is already running (this row's, another row's, or a held-items batch), so no new one may start. */
  blocked: boolean;
  requested: string[];
  quotes: ReadonlyMap<string, PriceQuote>;
  onPrice: (row: SheetRow) => void;
}

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

const PROFIT_BAR_LIMIT = 20;
const HOLD_MS = 450;
const HOLD_SLOP = 8;
const isControl = (target: EventTarget) => target instanceof Element && Boolean(target.closest('button, a, input'));

const ENTRY_STAGGER_MS = 155;
const ENTRY_WINDOW_MS = 950;
const ENTRY_MARKS = ['*+*', '+.+', '.*.', '.+.'];
const ENTRY_GLYPH_HEIGHT = 8;

function tradeOutcome(row: SheetRow) {
  const net = row.status === 'closed' ? roundTo(row.net ?? 0, 2) : 0;
  return net > 0 ? 'gain' : net < 0 ? 'loss' : undefined;
}

function useOutcomeEntry(table: RefObject<HTMLTableElement>, rows: SheetRow[]) {
  const initialRows = useRef(rows);
  const [intro, setIntro] = useState<{
    visibleRows: { key: string; index: number }[];
    byKey: Map<string, { delay: number; lines: number }>;
    last: string;
  }>();
  useLayoutEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const element = table.current;
    const scrollport = element?.closest('.tablewrap');
    if (motion.matches || !element || !scrollport) return;

    const { top, bottom } = scrollport.getBoundingClientRect();
    const totalsTop = element.tFoot?.rows[0]?.cells[0]?.getBoundingClientRect().top ?? bottom;
    const visible = Math.min(totalsTop, bottom);
    const visibleRows = [...element.querySelectorAll('tbody > .row')].flatMap((element, index) => {
      const row = initialRows.current[index];
      const rect = element.getBoundingClientRect();
      return row && rect.top < visible && rect.bottom > top ? [{ row, index, height: rect.height }] : [];
    });
    const entries = visibleRows.filter(({ row }) => tradeOutcome(row));
    const last = entries.at(-1)?.row.key;
    if (!last) return;

    const stagger = Math.min(ENTRY_STAGGER_MS, Math.floor(ENTRY_WINDOW_MS / Math.max(1, entries.length - 1)));
    setIntro({
      visibleRows: visibleRows.map(({ row, index }) => ({ key: row.key, index })),
      byKey: new Map(entries.map(({ row, height }, index) => [
        row.key,
        { delay: index * stagger, lines: Math.max(3, Math.floor((height - 4) / ENTRY_GLYPH_HEIGHT)) },
      ])),
      last,
    });

    const handleMotion = () => { if (motion.matches) setIntro(undefined); };
    motion.addEventListener('change', handleMotion);
    return () => motion.removeEventListener('change', handleMotion);
  }, [table]);

  const current = intro?.visibleRows.every(({ key, index }) => rows[index]?.key === key) ? intro : undefined;
  useEffect(() => {
    if (intro && !current) setIntro(undefined);
  }, [intro, current]);

  return { entry: current, finish: () => setIntro(undefined) };
}

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

function MarketActions({ row, pricing }: { row: SheetRow; pricing?: FlipPricing }) {
  const name = row.item.marketHashName;
  const href = `${CSFLOAT_ORIGIN}/search?market_hash_name=${encodeURIComponent(name)}&sort_by=lowest_price&type=buy_now`;
  const quote = pricing?.requested.includes(row.key) ? pricing.quotes.get(name) : undefined;
  const busy = pricing?.active === row.key;
  const priceHint = quote && `Checked ${formatTimeAgo(quote.fetchedAt)}. Click to refresh.`;
  return (
    <span className="market-actions">
      <a className="market-link" href={href} target="_blank" rel="noreferrer" aria-label={`View CSFloat listings for ${name} (opens in a new tab)`}>
        Listings <span aria-hidden="true">↗</span>
      </a>
      {pricing && (
        <button className="link market-link market-price" disabled={pricing.blocked} onClick={() => pricing.onPrice(row)} title={priceHint}
          aria-label={busy ? `Pricing ${name}` : quote ? `Refresh price for ${name}` : `Price item: ${name}`}>
          <span aria-live="polite">{busy ? 'Pricing…' : quote ? 'Refresh prices' : 'Price item'}</span>
          {busy && <span className="row-price-signal"><Signal compact /></span>}
          {quote && !busy && <span aria-hidden="true">↻</span>}
        </button>
      )}
      {quote && <MarketPrices item={row.item} quote={quote} />}
    </span>
  );
}

function MarketPrices({ item, quote, onCheck, busy, disabled }: { item: Item; quote?: PriceQuote; onCheck?: () => void; busy?: boolean; disabled?: boolean }) {
  const bid = quote?.instantSell?.[itemPriceKey(item)];
  const lowest = !quote ? 'Not checked' : quote.priceCents === undefined ? 'No listings' : formatMoney(centsToDollars(quote.priceCents));
  const instant = bid?.status !== 'matched' ? 'Unavailable' : bid.priceCents === undefined ? 'No matching orders' : formatMoney(centsToDollars(bid.priceCents));
  return (
    <span className="market-quotes">
      <span title={quote && `Lowest buy-now listing for this market name, before fees. Checked ${formatTimeAgo(quote.fetchedAt)}.`}>
        <span className="market-quote-label">Lowest list</span> {lowest}
      </span>
      <span title={bid?.status === 'matched' ? `Highest buy order matching this item's attributes, before fees. Checked ${formatTimeAgo(bid.fetchedAt)}.` : bid ? 'Could not verify matching buy orders for this item. Check buy orders to try again.' : 'Buy orders are checked manually for this item.'}>
        <span className="market-quote-label">Insta sell</span> {bid || !onCheck ? instant : ''}
        {onCheck && <button className="link buy-order-check" onClick={onCheck} disabled={disabled}
          aria-label={`${busy ? 'Checking' : bid ? 'Refresh' : 'Check'} buy orders for ${item.marketHashName}`}>
          <span aria-live="polite">{busy ? 'Checking…' : bid ? 'Refresh' : 'Check buy orders'}</span>
          {busy && <span className="row-price-signal"><Signal compact /></span>}
        </button>}
      </span>
    </span>
  );
}

export function TradeInspector({ row, showMarketPrices, pricing }: { row: SheetRow; showMarketPrices: boolean; pricing?: FlipPricing }) {
  const title = itemTitle(row.item, (row.sell ?? row.buy)?.source);
  const open = row.status === 'open';
  return (
    <HoverCardProvider>
      <div className="trade-inspector" key={row.key}>
        <div>
          <h3>{title.name}</h3>
          <p className="hint">{[title.longDetail, open ? 'Open' : row.status === 'closed' ? 'Closed' : 'Unpaired sale'].filter(Boolean).join(' · ')}</p>
        </div>
        {row.net !== undefined && (
          <div className="inspector-profit">
            <span>Net profit</span>
            <strong className={`pl ${signClass(row.net)}`}>
              {formatSignedMoney(row.net)}{row.percent !== undefined && ` · ${formatPercent(row.percent)}`}
            </strong>
          </div>
        )}
        <TradeDetails row={row} inspector />
        <MarketActions row={row} pricing={open && !showMarketPrices ? pricing : undefined} />
        {open && showMarketPrices && <MarketPrices item={row.item} quote={row.marketQuote}
          onCheck={pricing && (() => pricing.onPrice(row))} busy={pricing?.active === row.key} disabled={pricing?.blocked} />}
      </div>
    </HoverCardProvider>
  );
}

function TradeDetails({ row, inspector = false }: { row: SheetRow; inspector?: boolean }) {
  const { item, quote } = row;
  const facts: [string, ReactNode][] = [
    ['Adj. float', adjustedFloat(item) === undefined ? null : <AdjustedFloatCell item={item} />],
    ['Pattern seed', item.floatValue === undefined ? null : item.paintSeed],
    ['Fade', item.fadePercent === undefined ? null : `${item.fadePercent.toFixed(1)}%`],
    ['Stickers and charms', item.stickers?.length || item.charms?.length ? <Accessories item={item} /> : null],
    ['Bought', formatDate(row.boughtAt)],
    ['Sold', formatDate(row.soldAt)],
    ['Held', formatDays(row.held)],
    ['Listing', row.listing && <ListedTag listing={row.listing} />],
    ['Match', <MatchLabel row={row} />],
    ['If sold now', quote && <Estimate quote={quote} signed={quote.net}>{formatSignedMoney(quote.net)} ({formatPercent(quote.percent)})</Estimate>],
  ];
  if (inspector) {
    facts.push(
      ['Float', formatFloat(item.floatValue, 6)],
      ['Buy', formatMoney(row.buyPrice)],
      ['Sell', formatMoney(row.sellPrice)],
      ['Fee', formatMoney(row.fee)],
    );
  }
  const available = facts.filter(([, value]) => value != null && value !== '');
  return (
    <dl className="trade-details">
      {available.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NetCell({ row, onPickBuy }: { row: SheetRow; onPickBuy: () => void }) {
  if (row.listing) return <ListedTag listing={row.listing} />;
  if (row.status === 'open') return <span className="tag open">Open</span>;
  if (row.ambiguous) return <button className="link" onClick={onPickBuy}>Pick buy</button>;
  if (row.status === 'sale') return <span className="tag open">No buy</span>;
  return <>{row.net === undefined ? '' : formatSignedMoney(row.net)}</>;
}

/** An open buy that's up for sale: the asking price, and what it nets if it sells there. */
function ListedTag({ listing }: { listing: ListedFor }) {
  const what = listing.auction ? 'Auction from' : 'Listed at';
  const hint = `${what} ${formatMoney(listing.price)} since ${formatDate(listing.listedAt)}. Nets ${formatSignedMoney(listing.net)} (${formatPercent(listing.percent)}) if it sells there.`;
  return (
    <span className="tag listed" title={hint}>
      {listing.auction ? 'Auction' : 'Listed'} {formatMoney(listing.price)}
    </span>
  );
}

/**
 * A figure for an open buy worked out from today's CSFloat price, not from a sale.
 * Muted, so it never reads as money already made.
 */
function Estimate({ quote, signed, children }: { quote: PricedAt; signed?: number; children: ReactNode }) {
  const estimate = quote.estimate === undefined ? '' : ` CSFloat estimates ${formatMoney(quote.estimate)}.`;
  const hint = `Cheapest CSFloat listing ${formatTimeAgo(quote.fetchedAt)}: ${formatMoney(quote.price)}.${estimate} Sold there, this nets ${formatSignedMoney(quote.net)} after the fee.`;
  return (
    <span className={`est ${signed === undefined ? '' : signClass(signed)}`} title={hint}>
      {children}
    </span>
  );
}

function MatchLabel({ row }: { row: SheetRow }) {
  if (row.match) {
    const { label, hint } = CONFIDENCE[row.match];
    return <span className={`match ${row.match === 'suggested' ? 'check' : ''}`} title={hint}>{label}</span>;
  }
  if (row.status === 'open') return <span className="match">Awaiting sale</span>;
  return <span className="match">{row.ambiguous ? 'Pick buy' : 'No buy'}</span>;
}

function ProfitPercent({ percent, detailed }: { percent: number; detailed: boolean }) {
  const magnitude = roundTo(Math.abs(percent), 1);
  const tone = magnitude === 0 ? '' : percent < 0 ? 'neg' : 'pos';
  const extent = Math.min(magnitude / PROFIT_BAR_LIMIT, 1) * 50;
  return (
    <span className={`profit-result ${tone}`}>
      <RollingNumber value={percent} text={magnitude === 0 ? '0.0%' : formatPercent(Math.sign(percent) * magnitude)} zero="0.0%" />
      {detailed && (
        <span className="profit-track" aria-hidden="true">
          {tone && <span className="profit-bar" style={{ width: `${extent}%` }} />}
        </span>
      )}
    </span>
  );
}

function ItemCell({ row, detailed, isNew, pricing }: { row: SheetRow; detailed: boolean; isNew: boolean; pricing?: FlipPricing }) {
  const { item } = row;
  const title = itemTitle(item, (row.sell ?? row.buy)?.source);
  const pending = [row.buy, row.sell].some((trade) => trade?.state === 'pending');
  const tags = (
    <>
      {isNew && <span className="tag new">New</span>}
      {pending && <span className="tag pending">Pending</span>}
    </>
  );
  const color = rarityColor(item) ?? 'var(--rule)';
  const hover = useHoverCard();
  const seed = item.paintSeed !== undefined && item.floatValue !== undefined ? `Seed ${item.paintSeed}` : undefined;
  const fade = item.fadePercent !== undefined ? `Fade ${item.fadePercent.toFixed(1)}%` : undefined;
  const card: CardContent = {
    iconUrl: item.iconUrl,
    title: title.name,
    lines: [title.longDetail, item.floatValue === undefined ? undefined : `Float ${item.floatValue}`, seed, fade].filter(isText),
    shape: 'item',
    color,
  };

  return (
    <div className="itm">
      {detailed ? (
        <span className="tile" style={{ '--r': color } as CSSProperties} aria-hidden="true" {...hover(card)}>
          <SteamImage iconUrl={item.iconUrl} width={128} height={96} />
        </span>
      ) : <span className="rar" style={{ '--r': color } as CSSProperties} aria-hidden="true" />}
      <div className="item-title">
        <span className="nm" {...hover(card)}>{title.name}</span>
        {title.detail && <span className="wear">{title.detail}</span>}
        {tags}
        <MarketActions row={row} pricing={pricing} />
      </div>
    </div>
  );
}

function Accessories({ item }: { item: Item }) {
  const stickers = [...(item.stickers ?? [])].sort((a, b) => a.slot - b.slot);
  const charms = item.charms ?? [];
  const hover = useHoverCard();
  if (stickers.length === 0 && charms.length === 0) return null;
  return (
    <span className="acc">
      {stickers.map((sticker, index) => (
        <span key={index} className="stk" aria-label={sticker.name} {...hover({ iconUrl: sticker.iconUrl, title: withoutPrefix(sticker.name), lines: [scrapeNote(sticker.wear)], shape: 'square' })}>
          <SteamImage iconUrl={sticker.iconUrl} width={64} fallback={withoutPrefix(sticker.name).charAt(0)} />
        </span>
      ))}
      {charms.map((charm, index) => (
        <span
          key={index}
          className="charm"
          aria-label={charm.name}
          {...hover({ iconUrl: charm.iconUrl, title: withoutPrefix(charm.name), lines: charm.pattern === undefined ? ['Charm'] : [`Charm, pattern #${charm.pattern}`], shape: 'square' })}
        >
          <SteamImage iconUrl={charm.iconUrl} width={64} fallback="" />
          {charm.pattern !== undefined && <span>#{charm.pattern}</span>}
        </span>
      ))}
    </span>
  );
}

function scrapeNote(wear?: number): string {
  return wear ? `${Math.round(wear * 100)}% scraped` : 'Not scraped';
}

/** "Sticker | Crown (Foil)" reads as just "Crown (Foil)" under a picture of the sticker. */
const withoutPrefix = (name: string) => name.replace(/^(Sticker|Patch|Charm) \| /, '');

const isText = (value: string | undefined): value is string => Boolean(value);

/** Hides itself if Steam doesn't answer, leaving the tile's rarity color or the fallback letter. */
function SteamImage({ iconUrl, width, height = width, fallback }: { iconUrl?: string; width: number; height?: number; fallback?: string }) {
  const src = steamImageUrl(iconUrl, width, height);
  if (!src) return fallback ? <span className="fallback">{fallback}</span> : null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(event) => event.currentTarget.classList.add('in')}
      onError={(event) => (event.currentTarget.hidden = true)}
    />
  );
}

const rangeText = (range: FloatRange) => `${range.min.toFixed(2)} to ${range.max.toFixed(2)}`;

function FloatCell({ item, detailed }: { item: Item; detailed: boolean }) {
  const value = item.floatValue;
  if (value === undefined) return null;
  const range = detailed ? floatRange(item) : undefined;
  return (
    <span className={range ? 'flt' : undefined} title={String(value)}>
      <RollingNumber value={value} text={formatFloat(value, 6)} zero="0.000000" />
      {range && (
        <span className="wbar" style={{ '--f': value, '--lo': range.min, '--hi': range.max } as CSSProperties}
          title={`${item.wearName ?? 'Wear'}. This skin's floats run ${rangeText(range)}.`}>
          <b className="cap l" />
          <b className="cap r" />
          <i />
        </span>
      )}
    </span>
  );
}

function AdjustedFloatCell({ item }: { item: Item }) {
  const range = floatRange(item);
  const adjusted = adjustedFloat(item);
  if (!range || adjusted === undefined) return null;
  return (
    <span className="flt">
      <span>{formatFloat(adjusted)}</span>
      <span className="capt">of {rangeText(range)}</span>
    </span>
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
