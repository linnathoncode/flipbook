import { itemKind, type ItemKind } from './itemKinds';
import { centsToDollars, heldDays, type Flip } from './profit';
import type { Trade } from './types';

export const ANALYTICS_PERIODS = ['30d', '90d', 'all'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { '30d': 30, '90d': 90, all: Infinity };
const DAY_MS = 24 * 60 * 60 * 1000;
const RANKED = 5;

export interface Analytics {
  /** Start of the charted span: the period's start, or the first sale for "all". */
  from: string;
  to: string;
  /** Closed flips sold in the period, oldest sale first. */
  closed: Flip[];
  net: number;
  winRate?: number;
  averagePercent?: number;
  averageHeldDays?: number;
  /** What the open buys on the Flips sheet cost. */
  openCost: number;
  /** Running net profit after each sale. */
  cumulative: { at: string; total: number }[];
  /** Every month in the span, "2026-10", including months with no sales. */
  byMonth: { month: string; net: number }[];
  /** Best kind first. */
  byKind: { kind: ItemKind; net: number; count: number }[];
  best: Flip[];
  worst: Flip[];
}

/** Flips whose sale date wasn't recorded (spreadsheet rows) can't be placed in time, so they're left out. */
export function analyze(flips: Flip[], openBuys: Trade[], period: AnalyticsPeriod, now: Date): Analytics {
  const to = now.toISOString();
  const cutoff = now.getTime() - PERIOD_DAYS[period] * DAY_MS;
  const closed = flips
    .filter((flip) => flip.sell.source !== 'xlsx' && Date.parse(flip.sell.at) >= cutoff)
    .sort((a, b) => a.sell.at.localeCompare(b.sell.at));
  const from = period === 'all' ? (closed[0]?.sell.at ?? to) : new Date(cutoff).toISOString();

  let running = 0;
  const cumulative = closed.map((flip) => ({ at: flip.sell.at, total: (running += flip.netProfit) }));
  const held = closed.map(heldDays).filter((days): days is number => days !== undefined);
  const byNet = [...closed].sort((a, b) => b.netProfit - a.netProfit);

  return {
    from,
    to,
    closed,
    net: running,
    winRate: closed.length ? closed.filter((flip) => flip.netProfit >= 0).length / closed.length : undefined,
    averagePercent: closed.length ? average(closed.map((flip) => flip.profitPercent)) : undefined,
    averageHeldDays: held.length ? average(held) : undefined,
    openCost: centsToDollars(openBuys.reduce((sum, buy) => sum + buy.priceCents, 0)),
    cumulative,
    byMonth: monthsBetween(from, to).map((month) => ({
      month,
      net: sumNet(closed.filter((flip) => flip.sell.at.startsWith(month))),
    })),
    byKind: groupByKind(closed),
    best: byNet.slice(0, RANKED).filter((flip) => flip.netProfit > 0),
    worst: byNet.slice(-RANKED).reverse().filter((flip) => flip.netProfit < 0),
  };
}

/** "2026-08", "2026-09", ... for every month the span touches. */
export function monthsBetween(fromIso: string, toIso: string): string[] {
  const months: string[] = [];
  let [year, month] = [Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7))];
  const last = toIso.slice(0, 7);
  for (let key = monthKey(year, month); key <= last; key = monthKey(year, month)) {
    months.push(key);
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  return months;
}

function groupByKind(flips: Flip[]) {
  const groups = new Map<ItemKind, { kind: ItemKind; net: number; count: number }>();
  flips.forEach((flip) => {
    const kind = itemKind(flip.buy.item);
    const group = groups.get(kind) ?? { kind, net: 0, count: 0 };
    group.net += flip.netProfit;
    group.count += 1;
    groups.set(kind, group);
  });
  return [...groups.values()].sort((a, b) => b.net - a.net);
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const sumNet = (flips: Flip[]) => flips.reduce((sum, flip) => sum + flip.netProfit, 0);
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
