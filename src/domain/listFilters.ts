import { heldDays, type Flip } from './profit';
import type { Item, MatchConfidence, Trade } from './types';

export const ITEM_KINDS = ['skin', 'sticker', 'case', 'agent', 'other'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const PERIODS = ['7d', '30d', '90d', '1y', 'all'] as const;
export type Period = (typeof PERIODS)[number];

export type ResultFilter = 'all' | 'profit' | 'loss';

export interface ListFilter {
  query: string;
  /** Empty means every kind. */
  kinds: ItemKind[];
  result: ResultFilter;
  period: Period;
  /** Empty means every match type. */
  matches: MatchConfidence[];
}

export const EMPTY_FILTER: ListFilter = { query: '', kinds: [], result: 'all', period: 'all', matches: [] };

export function isUnfiltered(filter: ListFilter): boolean {
  return (
    !filter.query.trim() &&
    filter.kinds.length === 0 &&
    filter.result === 'all' &&
    filter.period === 'all' &&
    filter.matches.length === 0
  );
}

export const FLIP_SORT_KEYS = ['sold', 'bought', 'name', 'buyPrice', 'sellPrice', 'net', 'percent', 'held'] as const;
export type FlipSortKey = (typeof FLIP_SORT_KEYS)[number];
export const HOLDING_SORT_KEYS = ['bought', 'name', 'buyPrice'] as const;
export type HoldingSortKey = (typeof HOLDING_SORT_KEYS)[number];

export interface Sort<Key extends string> {
  key: Key;
  descending: boolean;
}

const KIND_BY_TYPE: Record<string, ItemKind> = {
  skin: 'skin',
  sticker: 'sticker',
  patch: 'sticker',
  container: 'case',
  agent: 'agent',
};

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: Infinity };
const DAY_MS = 24 * 60 * 60 * 1000;

export function itemKind(item: Item): ItemKind {
  return KIND_BY_TYPE[item.type] ?? 'other';
}

export function filterFlips(flips: Flip[], filter: ListFilter, now: Date): Flip[] {
  return flips.filter(
    (flip) =>
      matchesItem(flip.buy.item, filter) &&
      isWithin(flip.sell.at, filter.period, now) &&
      matchesResult(flip.netProfit, filter.result) &&
      (filter.matches.length === 0 || filter.matches.includes(flip.match.confidence)),
  );
}

/** Holdings have no result or match, so only the item and period filters apply. */
export function filterHoldings(buys: Trade[], filter: ListFilter, now: Date): Trade[] {
  return buys.filter((buy) => matchesItem(buy.item, filter) && isWithin(buy.at, filter.period, now));
}

export function sortFlips(flips: Flip[], sort: Sort<FlipSortKey>): Flip[] {
  const value = FLIP_SORT_VALUE[sort.key];
  return sortBy(flips, value, sort.descending);
}

export function sortHoldings(buys: Trade[], sort: Sort<HoldingSortKey>): Trade[] {
  const value = HOLDING_SORT_VALUE[sort.key];
  return sortBy(buys, value, sort.descending);
}

type SortValue<T> = (entry: T) => string | number | undefined;

const FLIP_SORT_VALUE: Record<FlipSortKey, SortValue<Flip>> = {
  sold: (flip) => flip.sell.at,
  bought: (flip) => flip.buy.at,
  name: (flip) => flip.buy.item.marketHashName.toLowerCase(),
  buyPrice: (flip) => flip.buyPrice,
  sellPrice: (flip) => flip.sellPrice,
  net: (flip) => flip.netProfit,
  percent: (flip) => flip.profitPercent,
  held: heldDays,
};

const HOLDING_SORT_VALUE: Record<HoldingSortKey, SortValue<Trade>> = {
  bought: (buy) => buy.at,
  name: (buy) => buy.item.marketHashName.toLowerCase(),
  buyPrice: (buy) => buy.priceCents,
};

/** Entries with no value (e.g. unknown hold time) always sink to the bottom. */
function sortBy<T>(entries: T[], value: SortValue<T>, descending: boolean): T[] {
  const direction = descending ? -1 : 1;
  return [...entries].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === undefined || right === undefined) return left === right ? 0 : left === undefined ? 1 : -1;
    if (left < right) return -direction;
    if (left > right) return direction;
    return 0;
  });
}

function matchesItem(item: Item, filter: ListFilter): boolean {
  const query = filter.query.trim().toLowerCase();
  const nameMatches = !query || item.marketHashName.toLowerCase().includes(query);
  const kindMatches = filter.kinds.length === 0 || filter.kinds.includes(itemKind(item));
  return nameMatches && kindMatches;
}

function matchesResult(netProfit: number, result: ResultFilter): boolean {
  if (result === 'profit') return netProfit > 0;
  if (result === 'loss') return netProfit < 0;
  return true;
}

function isWithin(iso: string, period: Period, now: Date): boolean {
  return now.getTime() - Date.parse(iso) <= PERIOD_DAYS[period] * DAY_MS;
}
