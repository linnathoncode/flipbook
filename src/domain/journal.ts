import { matchTrades } from './matcher';
import { buildFlip, summarize, type Flip, type ProfitSummary } from './profit';
import type { Match, Trade, UnmatchedSell } from './types';

export interface JournalView {
  flips: Flip[];
  openBuys: Trade[];
  unmatchedSells: (UnmatchedSell & { sell: Trade; candidates: Trade[] })[];
  /** Only verified flips; pending trades can still be reversed by CSFloat. */
  summary: ProfitSummary;
  tradesById: Map<string, Trade>;
}

export function buildJournalView(trades: Trade[], lockedMatches: Match[], feeRate: number): JournalView {
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
  const lookup = (id: string) => tradesById.get(id)!;
  const result = matchTrades(trades, lockedMatches);

  const flips = result.matches
    .map((match) => buildFlip(match, lookup(match.buyId), lookup(match.sellId), feeRate))
    .sort((a, b) => b.sell.at.localeCompare(a.sell.at));
  const settledFlips = flips.filter((flip) => flip.sell.state === 'verified' && flip.buy.state === 'verified');

  return {
    flips,
    openBuys: result.openBuyIds.map(lookup),
    unmatchedSells: result.unmatchedSells.map((unmatched) => ({
      ...unmatched,
      sell: lookup(unmatched.sellId),
      candidates: unmatched.candidateBuyIds.map(lookup),
    })),
    summary: summarize(settledFlips),
    tradesById,
  };
}
