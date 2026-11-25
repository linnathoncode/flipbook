import { itemKind, type ItemKind } from './itemKinds';
import { centsToDollars, heldDays, type Flip } from './profit';
import type { Trade } from './types';

export const ANALYTICS_PERIODS = ['30d', '90d', 'all'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { '30d': 30, '90d': 90, all: Infinity };
const DAY_MS = 24 * 60 * 60 * 1000;
const RANKED = 5;
const HOLD_BUCKETS = [
  { label: '0-7 days', max: 7 },
  { label: '8-30 days', max: 30 },
  { label: '31-90 days', max: 90 },
  { label: '91+ days', max: Infinity },
] as const;

export interface Analytics {
  /** Start of the charted span: the period's start, or the first sale for "all". */
  from: string;
  to: string;
  /** Closed flips sold in the period, oldest sale first. */
  closed: Flip[];
  net: number;
  closedCost: number;
  proceeds: number;
  fees: number;
  weightedReturn?: number;
  medianHeldDays?: number;
  outcomes: { profitable: number; flops: number; even: number; gains: number; losses: number };
  topThreeGainShare?: number;
  byHold: { label: string; net: number; count: number; sellIds: string[] }[];
  winRate?: number;
  averagePercent?: number;
  averageHeldDays?: number;
  /** What the open buys on the Flips sheet cost. */
  openCost: number;
  /** Running net profit after each sale. */
  cumulative: { at: string; total: number }[];
  /** Every month in the span, "2026-10", including months with no sales. */
  byMonth: { month: string; net: number; sellIds: string[] }[];
  /** Best kind first. */
  byKind: { kind: ItemKind; net: number; count: number; sellIds: string[] }[];
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
  const profitable = byNet.filter((flip) => Math.round(flip.netProfit * 100) > 0);
  const flops = byNet.filter((flip) => Math.round(flip.netProfit * 100) < 0);
  const gains = sumNet(profitable);
  const closedCost = closed.reduce((sum, flip) => sum + flip.buyPrice, 0);

  return {
    from,
    to,
    closed,
    net: running,
    closedCost,
    proceeds: closed.reduce((sum, flip) => sum + flip.sellPrice, 0),
    fees: closed.reduce((sum, flip) => sum + flip.fee, 0),
    weightedReturn: closedCost > 0 ? (running / closedCost) * 100 : undefined,
    medianHeldDays: median(held),
    outcomes: {
      profitable: profitable.length, flops: flops.length, even: closed.length - profitable.length - flops.length,
      gains, losses: sumNet(flops),
    },
    topThreeGainShare: gains > 0 ? sumNet(profitable.slice(0, 3)) / gains : undefined,
    byHold: groupByHold(closed),
    winRate: closed.length ? (closed.length - flops.length) / closed.length : undefined,
    averagePercent: closed.length ? average(closed.map((flip) => flip.profitPercent)) : undefined,
    averageHeldDays: held.length ? average(held) : undefined,
    openCost: centsToDollars(openBuys.reduce((sum, buy) => sum + buy.priceCents, 0)),
    cumulative,
    byMonth: monthsBetween(from, to).map((month) => {
      const trades = closed.filter((flip) => flip.sell.at.startsWith(month));
      return { month, net: sumNet(trades), sellIds: trades.map((flip) => flip.sell.id) };
    }),
    byKind: groupByKind(closed),
    best: profitable.slice(0, RANKED),
    worst: flops.reverse().slice(0, RANKED),
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

function groupByHold(flips: Flip[]) {
  const buckets = HOLD_BUCKETS.map(({ label }) => ({ label, count: 0, net: 0, sellIds: [] as string[] }));
  for (const flip of flips) {
    const days = heldDays(flip);
    if (days === undefined) continue;
    const bucket = buckets[HOLD_BUCKETS.findIndex(({ max }) => days <= max)];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.net += flip.netProfit;
    bucket.sellIds.push(flip.sell.id);
  }
  return buckets;
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}

function groupByKind(flips: Flip[]) {
  const groups = new Map<ItemKind, Analytics['byKind'][number]>();
  flips.forEach((flip) => {
    const kind = itemKind(flip.buy.item);
    const group = groups.get(kind) ?? { kind, net: 0, count: 0, sellIds: [] };
    group.net += flip.netProfit;
    group.count += 1;
    group.sellIds.push(flip.sell.id);
    groups.set(kind, group);
  });
  return [...groups.values()].sort((a, b) => b.net - a.net);
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const sumNet = (flips: Flip[]) => flips.reduce((sum, flip) => sum + flip.netProfit, 0);
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
