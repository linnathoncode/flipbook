export type TradeSide = 'buy' | 'sell';

/** Only these states represent money that actually changed hands (or is about to). */
export type TradeState = 'verified' | 'pending';

export type TradeSource = 'csfloat' | 'xlsx' | 'manual';

/** Item type for tracker rows, which don't record what kind of item they are. */
export const UNKNOWN_TYPE = 'unknown';

export interface Item {
  marketHashName: string;
  itemName: string;
  wearName?: string;
  type: string;
  /** CS2 rarity tier as the game names it, e.g. "Classified". */
  rarityName?: string;
  /** ★ items: knives and gloves. */
  isStarred: boolean;
  defIndex?: number;
  paintIndex?: number;
  paintSeed?: number;
  floatValue?: number;
  isStatTrak: boolean;
  isSouvenir: boolean;
  iconUrl?: string;
  inspectLink?: string;
}

export interface Trade {
  id: string;
  side: TradeSide;
  state: TradeState;
  priceCents: number;
  /** ISO timestamp of when the trade was created. */
  at: string;
  source: TradeSource;
  item: Item;
  /** Overrides the default marketplace fee rate for this sell. */
  feeRate?: number;
}

/**
 * exact: same float fingerprint · fifo: oldest interchangeable item · suggested: only same-name buy
 * tracker: paired on a row of the user's spreadsheet · manual: picked in the dashboard
 */
export type MatchConfidence = 'exact' | 'fifo' | 'suggested' | 'tracker' | 'manual';

export interface Match {
  sellId: string;
  buyId: string;
  confidence: MatchConfidence;
}

export type UnmatchedReason = 'no-candidate' | 'ambiguous';

export interface UnmatchedSell {
  sellId: string;
  reason: UnmatchedReason;
  candidateBuyIds: string[];
}

export interface MatchResult {
  matches: Match[];
  unmatchedSells: UnmatchedSell[];
  openBuyIds: string[];
}
