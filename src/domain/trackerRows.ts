import { nameKey } from './itemNames';
import { UNKNOWN_TYPE, type Match, type Trade, type TradeSide } from './types';

/** One row of the hand-kept Flips sheet. Prices in dollars, as typed. */
export interface TrackerRow {
  rowNumber: number;
  skinName: string;
  buyPrice: number;
  sellPrice?: number;
  buyDate?: string;
}

export interface ReconciledTracker {
  /** Tracker rows with no CSFloat counterpart (bought or sold elsewhere, or before the sync window). */
  newTrades: Trade[];
  /** The tracker's row pairing is the user's own record, so it's kept as a locked match. */
  lockedMatches: Match[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_DATE = new Date(0).toISOString();
const SAME_PURCHASE_MAX_DAYS = 1;

/**
 * Links each tracker row to the CSFloat trade it describes (same name and price,
 * nearest date), and creates stand-in trades for rows that have none.
 */
export function reconcileTrackerRows(rows: TrackerRow[], knownTrades: Trade[]): ReconciledTracker {
  // Earlier tracker imports are replaced by id, never treated as counterparts.
  const marketTrades = knownTrades.filter((trade) => trade.source !== 'xlsx');
  const claimed = new Set<string>();
  const newTrades: Trade[] = [];
  const lockedMatches: Match[] = [];

  const resolve = (row: TrackerRow, side: TradeSide, dollars: number, standInAt: string): Trade => {
    const found = findCounterpart(row, side, dollars, marketTrades, claimed);
    if (found) {
      claimed.add(found.id);
      return found;
    }
    const standIn = trackerTrade(row, side, dollars, standInAt);
    newTrades.push(standIn);
    return standIn;
  };

  for (const row of rows) {
    const buy = resolve(row, 'buy', row.buyPrice, row.buyDate ?? UNKNOWN_DATE);
    if (row.sellPrice === undefined) continue;
    // The tracker has no sell date; a stand-in sell is placed at its buy so ordering stays valid.
    const sell = resolve(row, 'sell', row.sellPrice, buy.at);
    lockedMatches.push({ sellId: sell.id, buyId: buy.id, confidence: 'tracker' });
  }
  return { newTrades, lockedMatches };
}

function findCounterpart(
  row: TrackerRow,
  side: TradeSide,
  dollars: number,
  trades: Trade[],
  claimed: Set<string>,
): Trade | undefined {
  const key = nameKey(row.skinName);
  const sameItem = trades.filter(
    (trade) => !claimed.has(trade.id) && trade.side === side && nameKey(trade.item.marketHashName) === key,
  );
  const samePrice = sameItem.filter((trade) => trade.priceCents === toCents(dollars));
  if (side === 'sell' || !row.buyDate) return samePrice[0];

  const rowTime = Date.parse(row.buyDate);
  const byDistance = (a: Trade, b: Trade) => daysBetween(a, rowTime) - daysBetween(b, rowTime);
  // A hand-typed price can be off by a few cents; a buy on the same day is still the same purchase.
  const sameDay = sameItem.filter((trade) => daysBetween(trade, rowTime) <= SAME_PURCHASE_MAX_DAYS);
  return samePrice.sort(byDistance)[0] ?? sameDay.sort(byDistance)[0];
}

function trackerTrade(row: TrackerRow, side: TradeSide, dollars: number, at: string): Trade {
  return {
    id: `xlsx:${row.rowNumber}:${side}`,
    side,
    state: 'verified',
    priceCents: toCents(dollars),
    at,
    source: 'xlsx',
    item: {
      marketHashName: row.skinName.trim(),
      itemName: row.skinName.trim(),
      type: UNKNOWN_TYPE,
      isStarred: row.skinName.trim().startsWith('★'),
      isStatTrak: false,
      isSouvenir: false,
    },
  };
}

function daysBetween(trade: Trade, time: number): number {
  return Math.abs(Date.parse(trade.at) - time) / DAY_MS;
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
