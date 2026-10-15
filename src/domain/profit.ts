import type { Match, Trade } from './types';

/** CSFloat's current seller fee. Kept configurable since their terms allow up to 5%. */
export const DEFAULT_FEE_RATE = 0.02;

export interface Flip {
  match: Match;
  buy: Trade;
  sell: Trade;
  buyPrice: number;
  sellPrice: number;
  fee: number;
  netProfit: number;
  profitPercent: number;
}

export interface ProfitSummary {
  flipCount: number;
  totalProfit: number;
  averagePercent: number;
  /** Profit % weighted by buy price, the same as the tracker's "Weighted Avg %". */
  weightedAveragePercent: number;
}

const CENTS_PER_DOLLAR = 100;

export const centsToDollars = (cents: number) => cents / CENTS_PER_DOLLAR;

export function buildFlip(match: Match, buy: Trade, sell: Trade, defaultFeeRate = DEFAULT_FEE_RATE): Flip {
  const buyPrice = centsToDollars(buy.priceCents);
  const sellPrice = centsToDollars(sell.priceCents);
  const fee = sellPrice * (sell.feeRate ?? defaultFeeRate);
  const netProfit = sellPrice - buyPrice - fee;
  const profitPercent = buyPrice > 0 ? (netProfit / buyPrice) * 100 : 0;
  return { match, buy, sell, buyPrice, sellPrice, fee, netProfit, profitPercent };
}

export function summarize(flips: Flip[]): ProfitSummary {
  const totalProfit = sum(flips.map((flip) => flip.netProfit));
  const totalBuy = sum(flips.map((flip) => flip.buyPrice));
  const averagePercent = flips.length ? sum(flips.map((flip) => flip.profitPercent)) / flips.length : 0;
  const weightedAveragePercent = totalBuy
    ? sum(flips.map((flip) => flip.profitPercent * flip.buyPrice)) / totalBuy
    : 0;
  return { flipCount: flips.length, totalProfit, averagePercent, weightedAveragePercent };
}

/** Only flips where both trades are verified; pending trades can still be reversed by CSFloat. */
export function summarizeSettled(flips: Flip[]): ProfitSummary {
  return summarize(flips.filter((flip) => flip.buy.state === 'verified' && flip.sell.state === 'verified'));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between buying and selling; undefined when the sell date wasn't recorded. */
export function heldDays(flip: Flip): number | undefined {
  if (flip.sell.source === 'xlsx') return undefined;
  return Math.max(0, Math.round((Date.parse(flip.sell.at) - Date.parse(flip.buy.at)) / DAY_MS));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
