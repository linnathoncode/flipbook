import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { adjustedFloat, floatRange, type FloatRange } from '../../domain/floatRanges';
import { totalRows, type ListedFor, type PricedAt, type SheetRow, type Sort } from '../../domain/listFilters';
import type { PriceQuote } from '../../domain/prices';
import { centsToDollars } from '../../domain/profit';
import type { Item } from '../../domain/types';
import { CSFLOAT_ORIGIN } from '../../io/csfloatSync';
import { formatDate, formatDays, formatFloat, formatMoney, formatPercent, formatSignedMoney, formatTimeAgo, plural } from '../format';
import { rarityColor } from '../rarity';
import { steamImageUrl } from '../steamImages';
import type { Entry, Selection } from '../useSelection';
import { HoverCardProvider, useHoverCard, type CardContent } from './HoverCard';
import { CONFIDENCE, isAfter, itemTitle, signClass, SortHeader } from './shared';

export type RowDetail = 'compact' | 'detailed';

export interface FlipPricing {
  active?: string;
  requested: string[];
  quotes: ReadonlyMap<string, PriceQuote>;
  onPrice: (row: SheetRow) => void;
}

interface Props {
  /** The rows on this page. */
  rows: SheetRow[];
  /** Every row that passed the filters; the totals cover all of them, not just this page. */
  allRows: SheetRow[];
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

export function SheetTable({ rows, allRows, detail, showMarketPrices, sort, onSort, selection, newSince, flipPricing, empty, onRowMenu, onRowDrag, onPickBuy }: Props) {
  const detailed = detail === 'detailed';
  const [expandedKey, setExpandedKey] = useState<string>();
  const detailsId = useId();
  const hold = useRef<{ pointer: number; x: number; y: number; timer: ReturnType<typeof setTimeout> }>();
  const suppressClick = useRef(false);
  const visible = rows.map(rowEntry);
  const totals = totalRows(allRows);
  const header = { sort, onSort };
  // Holds are mostly unsold: the sale columns step aside for today's price, and a sheet of flips never shows price columns.
  const sold = allRows.some((row) => row.status !== 'open');
  // A listing alone doesn't add the price columns; on sheets without them it shows in the Net column.
  const columnCount = 6 + (sold ? 3 : 0) + (showMarketPrices ? 2 : 0);

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
  const toggleDetails = (key: string) => setExpandedKey((current) => current === key ? undefined : key);

  return (
    <HoverCardProvider>
    <table
      className="sheet"
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
          <SortHeader label="Item" sortKey="name" {...header} />
          <SortHeader label="Float" sortKey="float" numeric {...header} />
          <SortHeader label="Buy" sortKey="buyPrice" numeric {...header} />
          {showMarketPrices && (
            <>
              <SortHeader label="Now" sortKey="nowPrice" numeric title="The cheapest CSFloat listing for this item" {...header} />
              <SortHeader label="If sold now" sortKey="nowNet" numeric title="Estimated profit at that price after fees" {...header} />
            </>
          )}
          {sold && (
            <>
              <SortHeader label="Sell" sortKey="sellPrice" numeric {...header} />
              <th className="n" scope="col">Fee</th>
            </>
          )}
          <SortHeader label="Net profit" sortKey="net" numeric {...header} />
          {sold && <SortHeader label="Profit %" sortKey="percent" numeric {...header} />}
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
          const result = row.net === undefined ? '' : row.net >= 0 ? 'win' : 'loss';
          const isNew = isAfter(row.boughtAt, newSince) || isAfter(row.soldAt, newSince);
          const clickRow = (event: MouseEvent) => {
            if (isControl(event.target)) return;
            const add = event.ctrlKey || event.metaKey;
            if (selection.count || add || event.shiftKey) {
              selection.click(entry, { add: add || !event.shiftKey, range: event.shiftKey }, visible);
            } else {
              toggleDetails(row.key);
            }
          };
          return (
            <Fragment key={row.key}>
              <tr
                className={`row ${row.status} ${result} ${selected ? 'sel' : ''} ${expanded ? 'expanded' : ''}`}
                aria-selected={selected}
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
                  <input type="checkbox" checked={selected} onChange={() => selection.click(entry, { add: true, range: false }, visible)} aria-label={`Select ${row.item.marketHashName}`} />
                </td>
                <td className="n m">{formatDate(row.boughtAt)}</td>
                <td>
                  <div className="item-with-disclosure">
                    <button className="row-disclosure" aria-label={`Details for ${row.item.marketHashName}`} aria-expanded={expanded}
                      aria-controls={expanded ? detailsId : undefined} onClick={() => toggleDetails(row.key)}>
                      <span aria-hidden="true">›</span>
                    </button>
                    <ItemCell row={row} detailed={detailed} isNew={isNew} pricing={row.status === 'open' ? flipPricing : undefined} />
                  </div>
                </td>
                <td className="n m"><FloatCell item={row.item} detailed={detailed} /></td>
                <td className="n">{formatMoney(row.buyPrice)}</td>
                {showMarketPrices && (
                  <>
                    <td className="n">{row.quote && <Estimate quote={row.quote}>{formatMoney(row.quote.price)}</Estimate>}</td>
                    <td className="n pl">
                      {row.quote && <Estimate quote={row.quote} signed={row.quote.net}>{formatSignedMoney(row.quote.net)}</Estimate>}
                    </td>
                  </>
                )}
                {sold && (
                  <>
                    <td className="n">{formatMoney(row.sellPrice)}</td>
                    <td className="n m">{formatMoney(row.fee)}</td>
                  </>
                )}
                <td className={`n pl ${signClass(row.net)}`}><NetCell row={row} onPickBuy={onPickBuy} /></td>
                {sold && (
                  <td className={`n pl ${signClass(row.percent)}`}>
                    {row.percent === undefined ? '' : formatPercent(row.percent)}
                  </td>
                )}
              </tr>
              {expanded && (
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
          <td colSpan={4}>{plural(totals.rows, 'row')}</td>
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
          {sold && (
            <>
              <td className="n">{formatMoney(totals.sell)}</td>
              <td className="n m">{formatMoney(totals.fee)}</td>
            </>
          )}
          <td className={`n pl ${signClass(totals.net)}`}>{totals.net === undefined ? '' : formatSignedMoney(totals.net)}</td>
          {sold && (
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
  const priceText = quote?.priceCents === undefined ? 'No listings' : `Est. ${formatMoney(centsToDollars(quote.priceCents))}`;
  const priceHint = quote && `${quote.priceCents === undefined ? 'No buy-now listings' : 'Lowest buy-now listing'}, checked ${formatTimeAgo(quote.fetchedAt)}. Click to refresh.`;
  return (
    <span className="market-actions">
      <a className="market-link" href={href} target="_blank" rel="noreferrer" aria-label={`View CSFloat listings for ${name} (opens in a new tab)`}>
        Listings <span aria-hidden="true">↗</span>
      </a>
      {pricing && (
        <button className="btn market-price" disabled={pricing.active !== undefined} onClick={() => pricing.onPrice(row)} title={priceHint}
          aria-label={busy ? `Pricing ${name}` : quote ? `${priceText}. Refresh price for ${name}` : `Price item: ${name}`}>
          <span aria-live="polite">{busy ? 'Pricing…' : quote ? priceText : 'Price item'}</span>
          {quote && !busy && <span aria-hidden="true">↻</span>}
        </button>
      )}
    </span>
  );
}

function TradeDetails({ row }: { row: SheetRow }) {
  const { item, quote } = row;
  const facts: [string, ReactNode][] = [
    ['Adj. float', adjustedFloat(item) === undefined ? null : <AdjustedFloatCell item={item} />],
    ['Pattern seed', item.floatValue === undefined ? null : item.paintSeed],
    ['Fade', item.fadePercent === undefined ? null : `${item.fadePercent.toFixed(1)}%`],
    ['Stickers and charms', item.stickers?.length || item.charms?.length ? <Accessories item={item} /> : null],
    ['Sold', formatDate(row.soldAt)],
    ['Held', formatDays(row.held)],
    ['Match', <MatchLabel row={row} />],
    ['If sold now', quote && <Estimate quote={quote} signed={quote.net}>{formatSignedMoney(quote.net)} ({formatPercent(quote.percent)})</Estimate>],
  ];
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
  if (item.floatValue === undefined) return null;
  const range = floatRange(item);
  if (!detailed || !range) return <span title={String(item.floatValue)}>{formatFloat(item.floatValue)}</span>;
  const bar = { '--f': item.floatValue, '--lo': range.min, '--hi': range.max } as CSSProperties;
  return (
    <span className="flt" title={String(item.floatValue)}>
      <span>{formatFloat(item.floatValue, 6)}</span>
      <span className="wbar" style={bar} title={`${item.wearName ?? 'Wear'}. This skin's floats run ${rangeText(range)}.`}>
        <b className="cap l" />
        <b className="cap r" />
        <i />
      </span>
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
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selectedCount > 0 && !all;
  }, [selectedCount, all]);
  return (
    <input ref={ref} type="checkbox" checked={all} onChange={() => selection.setAll(visible, !all)} aria-label="Select every row on this page" />
  );
}
