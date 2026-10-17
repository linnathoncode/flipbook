import { adjustedFloat } from './floatRanges';
import type { Section } from './folders';
import { itemKind, type ItemKind } from './itemKinds';
import type { UnmatchedEntry } from './journal';
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
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function sectionRows(section: Section, feeRate: number, now: Date): SheetRow[] {
  return [
    ...section.openBuys.map((buy) => openRow(buy, now)),
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

function openRow(buy: Trade, now: Date): SheetRow {
  return {
    key: `open:${buy.id}`,
    status: 'open',
    item: buy.item,
    tradeIds: [buy.id],
    buy,
    ambiguous: false,
    boughtAt: buy.at,
    buyPrice: centsToDollars(buy.priceCents),
    held: Math.max(0, Math.floor((now.getTime() - Date.parse(buy.at)) / DAY_MS)),
  };
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

export type ResultFilter = 'all' | 'open' | 'win' | 'loss';

export interface ListFilter {
  query: string;
  /** Empty means every kind. */
  kinds: ItemKind[];
  result: ResultFilter;
}

export const EMPTY_FILTER: ListFilter = { query: '', kinds: [], result: 'all' };

export function isUnfiltered(filter: ListFilter): boolean {
  return !filter.query.trim() && filter.kinds.length === 0 && filter.result === 'all';
}

export function filterRows(rows: SheetRow[], filter: ListFilter): SheetRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!query || row.item.marketHashName.toLowerCase().includes(query)) &&
      (filter.kinds.length === 0 || filter.kinds.includes(itemKind(row.item))) &&
      matchesResult(row, filter.result),
  );
}

function matchesResult(row: SheetRow, result: ResultFilter): boolean {
  if (result === 'open') return row.status === 'open';
  if (result === 'win') return row.net !== undefined && row.net >= 0;
  if (result === 'loss') return row.net !== undefined && row.net < 0;
  return true;
}

export const SORT_KEYS = ['bought', 'name', 'float', 'adjusted', 'buyPrice', 'sold', 'sellPrice', 'net', 'percent', 'held'] as const;
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
  return {
    rows: rows.length,
    closed: closed.length,
    buy: total((row) => row.buyPrice),
    sell: total((row) => row.sellPrice),
    fee: total((row) => row.fee),
    net,
    weightedPercent: net !== undefined && closedCost > 0 ? (net / closedCost) * 100 : undefined,
  };
}
