import { nameKey } from './itemNames';
import { UNKNOWN_TYPE, type Item, type Match, type MatchResult, type Trade, type UnmatchedSell } from './types';

/**
 * Pairs each sell with the buy it closes.
 *
 * Steam reissues asset IDs on every trade, so they can't link a buy to its
 * later sell. A skin's float + paint seed + paint index + def index is unique
 * instead. Items without a float (stickers, cases, pins) are interchangeable
 * and are closed first-in-first-out.
 */
export function matchTrades(trades: Trade[], lockedMatches: Match[] = []): MatchResult {
  const byTime = [...trades].sort(compareByTime);
  const tradeIds = new Set(byTime.map((trade) => trade.id));
  const usedBuyIds = new Set<string>();
  const matchedSellIds = new Set<string>();
  const matches: Match[] = [];

  const accept = (match: Match) => {
    matches.push(match);
    usedBuyIds.add(match.buyId);
    matchedSellIds.add(match.sellId);
  };

  lockedMatches
    .filter((match) => tradeIds.has(match.sellId) && tradeIds.has(match.buyId))
    .forEach(accept);

  const sells = byTime.filter((trade) => trade.side === 'sell' && !matchedSellIds.has(trade.id));
  const buys = byTime.filter((trade) => trade.side === 'buy');
  const openBuysBefore = (sell: Trade) =>
    buys.filter((buy) => !usedBuyIds.has(buy.id) && buy.at <= sell.at);

  const unmatchedSells: UnmatchedSell[] = [];
  for (const sell of sells) {
    const candidates = openBuysBefore(sell);
    const match = findExactMatch(sell, candidates) ?? findFifoMatch(sell, candidates);
    if (match) {
      accept(match);
      continue;
    }
    const sameName = candidates.filter((buy) => isSameName(buy.item, sell.item));
    if (sameName.length === 1) {
      accept({ sellId: sell.id, buyId: sameName[0].id, confidence: 'suggested' });
      continue;
    }
    unmatchedSells.push({
      sellId: sell.id,
      reason: sameName.length > 1 ? 'ambiguous' : 'no-candidate',
      candidateBuyIds: sameName.map((buy) => buy.id),
    });
  }

  const openBuyIds = buys.filter((buy) => !usedBuyIds.has(buy.id)).map((buy) => buy.id);
  return { matches, unmatchedSells, openBuyIds };
}

/** Same physical skin. If it was bought more than once, the latest buy is the one being sold. */
function findExactMatch(sell: Trade, candidates: Trade[]): Match | undefined {
  const sellFingerprint = fingerprint(sell.item);
  if (!sellFingerprint) return undefined;
  const latest = candidates.filter((buy) => fingerprint(buy.item) === sellFingerprint).at(-1);
  return latest && { sellId: sell.id, buyId: latest.id, confidence: 'exact' };
}

function findFifoMatch(sell: Trade, candidates: Trade[]): Match | undefined {
  if (!isCommodity(sell.item)) return undefined;
  const oldest = candidates.find((buy) => isCommodity(buy.item) && isSameName(buy.item, sell.item));
  return oldest && { sellId: sell.id, buyId: oldest.id, confidence: 'fifo' };
}

export function fingerprint(item: Item): string | undefined {
  const { defIndex, paintIndex, paintSeed, floatValue } = item;
  if (floatValue === undefined || defIndex === undefined) return undefined;
  return [defIndex, paintIndex ?? '', paintSeed ?? '', floatValue].join(':');
}

/** Float-less items of a known type. Tracker rows have no type, so they're never assumed interchangeable. */
function isCommodity(item: Item): boolean {
  return item.floatValue === undefined && item.type !== UNKNOWN_TYPE;
}

function isSameName(a: Item, b: Item): boolean {
  return nameKey(a.marketHashName) === nameKey(b.marketHashName);
}

function compareByTime(a: Trade, b: Trade): number {
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
}
