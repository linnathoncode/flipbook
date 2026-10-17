import { adjustedFloat } from './floatRanges';
import type { Section } from './folders';
import { itemKind, type ItemKind } from './itemKinds';
import type { UnmatchedEntry } from './journal';
import type { Listing } from './listings';
import type { PriceQuote } from './prices';
import { centsToDollars, heldDays, type Flip } from './profit';
import type { Item, MatchConfidence, Trade } from './types';

/**
 * One line of a sheet: a closed flip, a buy not sold yet, or a sale with no paired buy.
 * Figures are worked out once so filtering, sorting and totals agree.
 */
export interface SheetRow {
  key: string;
  status: 'closed' | 'open' | 'sale';
  item: Item;
  /** What moves when the row moves: both halves of a flip. */
  tradeIds: string[];
  buy?: Trade;
  sell?: Trade;
  flip?: Flip;
  /** Set on sales that more than one buy could be. */
  ambiguous: boolean;
  match?: MatchConfidence;
  boughtAt?: string;
  /** Rows typed into a spreadsheet have no sale date. */
  soldAt?: string;
  buyPrice?: number;
  sellPrice?: number;
  fee?: number;
  net?: number;
  percent?: number;
  held?: number;
  /** An open buy that is up for sale on CSFloat, with what it would make at that price. */
  listing?: ListedFor;
  /** An open buy priced at what it sells for on CSFloat now, and what selling there would make. */
  quote?: PricedAt;
}

export interface PricedAt {
  price: number;
  estimate?: number;
  fetchedAt: string;
  net: number;
  percent: number;
}

/** What the market says about open buys: which are listed, and what items sell for now. */
export interface MarketData {
  /** Open buy id to the listing selling it. */
  listed?: ReadonlyMap<string, Listing>;
  /** Market hash name to its latest price. */
  prices?: ReadonlyMap<string, PriceQuote>;
}

export interface ListedFor {
  price: number;
  listedAt: string;
  auction: boolean;
  net: number;
  percent: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function sectionRows(section: Section, feeRate: number, now: Date, market: MarketData = {}): SheetRow[] {
  return [
    ...section.openBuys.map((buy) => openRow(buy, now, feeRate, market.listed?.get(buy.id), market.prices?.get(buy.item.marketHashName))),
    ...section.flips.map(flipRow),
    ...section.sales.map((entry) => saleRow(entry, feeRate)),
  ];
}

function flipRow(flip: Flip): SheetRow {
  return {
    key: `flip:${flip.sell.id}`,
    status: 'closed',
    // The sell carries the item as it left, stickers and all.
    item: { ...flip.sell.item, floatValue: flip.sell.item.floatValue ?? flip.buy.item.floatValue },
    tradeIds: [flip.sell.id, flip.buy.id],
    buy: flip.buy,
    sell: flip.sell,
    flip,
    ambiguous: false,
    match: flip.match.confidence,
    boughtAt: flip.buy.at,
    soldAt: flip.sell.source === 'xlsx' ? undefined : flip.sell.at,
    buyPrice: flip.buyPrice,
    sellPrice: flip.sellPrice,
    fee: flip.fee,
    net: flip.netProfit,
    percent: flip.profitPercent,
    held: heldDays(flip),
  };
}

function openRow(buy: Trade, now: Date, feeRate: number, listing?: Listing, quote?: PriceQuote): SheetRow {
  const buyPrice = centsToDollars(buy.priceCents);
  return {
    key: `open:${buy.id}`,
    status: 'open',
    item: buy.item,
    tradeIds: [buy.id],
    buy,
    ambiguous: false,
    boughtAt: buy.at,
    buyPrice,
    held: Math.max(0, Math.floor((now.getTime() - Date.parse(buy.at)) / DAY_MS)),
    listing: listing && listedFor(listing, buyPrice, feeRate),
    quote: quote?.priceCents === undefined ? undefined : pricedAt(quote, quote.priceCents, buyPrice, feeRate),
  };
}

function pricedAt(quote: PriceQuote, priceCents: number, buyPrice: number, feeRate: number): PricedAt {
  return {
    ...ifSoldAt(centsToDollars(priceCents), buyPrice, feeRate),
    estimate: quote.estimateCents === undefined ? undefined : centsToDollars(quote.estimateCents),
    fetchedAt: quote.fetchedAt,
  };
}

function listedFor(listing: Listing, buyPrice: number, feeRate: number): ListedFor {
  return { ...ifSoldAt(centsToDollars(listing.priceCents), buyPrice, feeRate), listedAt: listing.listedAt, auction: listing.auction };
}

/** What an open buy would make sold at `price`, after the fee, the same way a closed flip is worked out. */
function ifSoldAt(price: number, buyPrice: number, feeRate: number) {
  const net = price * (1 - feeRate) - buyPrice;
  return { price, net, percent: buyPrice > 0 ? (net / buyPrice) * 100 : 0 };
}

function saleRow(entry: UnmatchedEntry, feeRate: number): SheetRow {
  const sellPrice = centsToDollars(entry.sell.priceCents);
  return {
    key: `sale:${entry.sell.id}`,
    status: 'sale',
    item: entry.sell.item,
    tradeIds: [entry.sell.id],
    sell: entry.sell,
    ambiguous: entry.reason === 'ambiguous',
    soldAt: entry.sell.at,
    sellPrice,
    fee: sellPrice * (entry.sell.feeRate ?? feeRate),
  };
}

export type ResultFilter = 'all' | 'open' | 'listed' | 'win' | 'loss';

export interface ListFilter {
  query: string;
  /** Empty means every kind. */
  kinds: ItemKind[];
  result: ResultFilter;
  /** Kinds and results to hide, whatever else is picked. */
  excludedKinds: ItemKind[];
  excludedResults: ResultFilter[];
}

export const EMPTY_FILTER: ListFilter = { query: '', kinds: [], result: 'all', excludedKinds: [], excludedResults: [] };

export function isUnfiltered(filter: ListFilter): boolean {
  return !filter.query.trim() && !isNarrowed(filter);
}

/** Any type or result chip in use, ignoring the search box. */
export function isNarrowed(filter: ListFilter): boolean {
  return filter.kinds.length > 0 || filter.result !== 'all' || filter.excludedKinds.length > 0 || filter.excludedResults.length > 0;
}

export function clearChips(filter: ListFilter): ListFilter {
  return { ...EMPTY_FILTER, query: filter.query };
}

/** Click picks a kind (or drops it); a kind that was hidden comes back picked. */
export function toggleKind(filter: ListFilter, kind: ItemKind): ListFilter {
  const excludedKinds = filter.excludedKinds.filter((k) => k !== kind);
  const kinds = filter.kinds.includes(kind) ? filter.kinds.filter((k) => k !== kind) : [...filter.kinds, kind];
  return { ...filter, kinds, excludedKinds };
}

/** Right-click hides a kind, or shows it again. */
export function toggleExcludedKind(filter: ListFilter, kind: ItemKind): ListFilter {
  const hidden = filter.excludedKinds.includes(kind);
  return {
    ...filter,
    kinds: filter.kinds.filter((k) => k !== kind),
    excludedKinds: hidden ? filter.excludedKinds.filter((k) => k !== kind) : [...filter.excludedKinds, kind],
  };
}

export function pickResult(filter: ListFilter, result: ResultFilter): ListFilter {
  return { ...filter, result, excludedResults: filter.excludedResults.filter((r) => r !== result) };
}

/** "All" can't be hidden. */
export function toggleExcludedResult(filter: ListFilter, result: ResultFilter): ListFilter {
  if (result === 'all') return filter;
  const hidden = filter.excludedResults.includes(result);
  return {
    ...filter,
    result: filter.result === result ? 'all' : filter.result,
    excludedResults: hidden ? filter.excludedResults.filter((r) => r !== result) : [...filter.excludedResults, result],
  };
}

export function filterRows(rows: SheetRow[], filter: ListFilter): SheetRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!query || row.item.marketHashName.toLowerCase().includes(query)) &&
      (filter.kinds.length === 0 || filter.kinds.includes(itemKind(row.item))) &&
      !filter.excludedKinds.includes(itemKind(row.item)) &&
      matchesResult(row, filter.result) &&
      !filter.excludedResults.some((result) => matchesResult(row, result)),
  );
}

function matchesResult(row: SheetRow, result: ResultFilter): boolean {
  if (result === 'open') return row.status === 'open';
  if (result === 'listed') return row.listing !== undefined;
  if (result === 'win') return row.net !== undefined && row.net >= 0;
  if (result === 'loss') return row.net !== undefined && row.net < 0;
  return true;
}

export const SORT_KEYS = ['bought', 'name', 'float', 'adjusted', 'buyPrice', 'sold', 'sellPrice', 'net', 'percent', 'held', 'nowPrice', 'nowNet', 'nowPercent'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface Sort {
  key: SortKey;
  descending: boolean;
}

type SortValue = (row: SheetRow) => string | number | undefined;

const SORT_VALUE: Record<SortKey, SortValue> = {
  // A sale with no buy sorts by when it sold, so it lands near the trades around it.
  bought: (row) => row.boughtAt ?? row.soldAt,
  name: (row) => row.item.marketHashName.replace(/^★\s*/, '').toLowerCase(),
  float: (row) => row.item.floatValue,
  adjusted: (row) => adjustedFloat(row.item),
  buyPrice: (row) => row.buyPrice,
  sold: (row) => row.soldAt,
  sellPrice: (row) => row.sellPrice,
  net: (row) => row.net,
  percent: (row) => row.percent,
  held: (row) => row.held,
  nowPrice: (row) => row.quote?.price,
  nowNet: (row) => row.quote?.net,
  nowPercent: (row) => row.quote?.percent,
};

/**
 * Rows with no value for the column (an open buy's net, a sticker's float) always sink to the bottom.
 * Sorted by buy date, everything still unsold comes first, so what you're holding never hides under older flips.
 */
export function sortRows(rows: SheetRow[], sort: Sort): SheetRow[] {
  const value = SORT_VALUE[sort.key];
  const direction = sort.descending ? -1 : 1;
  const openFirst = sort.key === 'bought';
  return [...rows].sort((a, b) => {
    if (openFirst && (a.status === 'open') !== (b.status === 'open')) return a.status === 'open' ? -1 : 1;
    const left = value(a);
    const right = value(b);
    if (left === undefined || right === undefined) return left === right ? 0 : left === undefined ? 1 : -1;
    if (left < right) return -direction;
    if (left > right) return direction;
    return 0;
  });
}

export interface RowTotals {
  rows: number;
  closed: number;
  buy?: number;
  sell?: number;
  fee?: number;
  net?: number;
  /** Net profit over what the closed flips cost, like the tracker's "Weighted Avg %". */
  weightedPercent?: number;
  /** Open buys at today's price: what they're worth, what selling them all would net, and that over what they cost. */
  nowPrice?: number;
  nowNet?: number;
  nowPercent?: number;
}

/** Blank where nothing in the rows has that figure, so an all-open sheet doesn't show $0.00 sold. */
export function totalRows(rows: SheetRow[]): RowTotals {
  const closed = rows.filter((row) => row.status === 'closed');
  const total = (pick: (row: SheetRow) => number | undefined) => {
    const values = rows.map(pick).filter((value): value is number => value !== undefined);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
  };
  const closedCost = closed.reduce((sum, row) => sum + (row.buyPrice ?? 0), 0);
  const net = closed.length ? closed.reduce((sum, row) => sum + (row.net ?? 0), 0) : undefined;
  const priced = rows.filter((row) => row.quote);
  const pricedCost = priced.reduce((sum, row) => sum + (row.buyPrice ?? 0), 0);
  const nowNet = priced.length ? priced.reduce((sum, row) => sum + row.quote!.net, 0) : undefined;
  return {
    rows: rows.length,
    closed: closed.length,
    buy: total((row) => row.buyPrice),
    sell: total((row) => row.sellPrice),
    fee: total((row) => row.fee),
    net,
    weightedPercent: net !== undefined && closedCost > 0 ? (net / closedCost) * 100 : undefined,
    nowPrice: total((row) => row.quote?.price),
    nowNet,
    nowPercent: nowNet !== undefined && pricedCost > 0 ? (nowNet / pricedCost) * 100 : undefined,
  };
}
