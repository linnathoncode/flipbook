import { UNKNOWN_TYPE, type Item, type Trade, type TradeState } from './types';

/** Shape of the subset of CSFloat's `/me/trades` response that we read. */
export interface CsfloatTrade {
  id: string;
  created_at: string;
  state: string;
  buyer_id: string;
  seller_id: string;
  contract: {
    price: number;
    item: CsfloatItem;
  };
}

interface CsfloatItem {
  market_hash_name: string;
  item_name?: string;
  wear_name?: string;
  type?: string;
  rarity_name?: string;
  def_index?: number;
  paint_index?: number;
  paint_seed?: number;
  float_value?: number;
  is_stattrak?: boolean;
  is_souvenir?: boolean;
  icon_url?: string;
  serialized_inspect?: string;
  inspect_link?: string;
}

export interface CsfloatTradesPage {
  trades: CsfloatTrade[];
  count: number;
}

const STAR = '★';
const KEPT_STATES: ReadonlySet<string> = new Set<TradeState>(['verified', 'pending']);

/**
 * The account owner is the only Steam ID present on every trade,
 * either as buyer or seller.
 */
export function detectOwnerSteamId(trades: CsfloatTrade[]): string | undefined {
  if (trades.length === 0) return undefined;
  const [first, ...rest] = trades;
  return [first.buyer_id, first.seller_id].find((id) =>
    rest.every((trade) => trade.buyer_id === id || trade.seller_id === id),
  );
}

export function normalizeCsfloatTrades(raw: CsfloatTrade[], ownerSteamId: string): Trade[] {
  return raw
    .filter((trade) => KEPT_STATES.has(trade.state))
    .filter((trade) => trade.buyer_id === ownerSteamId || trade.seller_id === ownerSteamId)
    .map((trade) => ({
      id: trade.id,
      side: trade.buyer_id === ownerSteamId ? 'buy' : 'sell',
      state: trade.state as TradeState,
      priceCents: trade.contract.price,
      at: trade.created_at,
      source: 'csfloat',
      item: normalizeItem(trade.contract.item),
    }));
}

function normalizeItem(raw: CsfloatItem): Item {
  return {
    marketHashName: raw.market_hash_name,
    itemName: raw.item_name ?? raw.market_hash_name,
    wearName: raw.wear_name,
    type: raw.type ?? UNKNOWN_TYPE,
    rarityName: raw.rarity_name,
    isStarred: raw.market_hash_name.startsWith(STAR),
    defIndex: raw.def_index,
    paintIndex: raw.paint_index,
    paintSeed: raw.paint_seed,
    floatValue: raw.float_value,
    isStatTrak: raw.is_stattrak ?? false,
    isSouvenir: raw.is_souvenir ?? false,
    iconUrl: raw.icon_url,
    inspectLink: raw.serialized_inspect ?? raw.inspect_link,
  };
}
