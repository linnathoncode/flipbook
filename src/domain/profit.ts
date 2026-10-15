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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
