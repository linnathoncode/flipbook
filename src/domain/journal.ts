import { matchTrades } from './matcher';
import { buildFlip, type Flip } from './profit';
import type { Match, Trade, UnmatchedSell } from './types';

export type UnmatchedEntry = UnmatchedSell & { sell: Trade; candidates: Trade[] };

export interface JournalView {
  flips: Flip[];
  openBuys: Trade[];
  unmatchedSells: UnmatchedEntry[];
  tradesById: Map<string, Trade>;
}

export function buildJournalView(trades: Trade[], lockedMatches: Match[], feeRate: number): JournalView {
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
  const lookup = (id: string) => tradesById.get(id)!;
  const result = matchTrades(trades, lockedMatches);

  const flips = result.matches
    .map((match) => buildFlip(match, lookup(match.buyId), lookup(match.sellId), feeRate))
    .sort((a, b) => b.sell.at.localeCompare(a.sell.at));

  return {
    flips,
    openBuys: result.openBuyIds.map(lookup),
    unmatchedSells: result.unmatchedSells.map((unmatched) => ({
      ...unmatched,
      sell: lookup(unmatched.sellId),
      candidates: unmatched.candidateBuyIds.map(lookup),
    })),
    tradesById,
  };
}
