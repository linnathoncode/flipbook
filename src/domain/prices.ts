import type { Item } from './types';

export interface InstantSellQuote {
  priceCents?: number;
  status: 'matched' | 'unavailable';
  fetchedAt: string;
}

export function itemPriceKey(item: Item): string {
  return JSON.stringify([
    item.marketHashName, item.defIndex, item.paintIndex, item.floatValue, item.paintSeed,
    item.stickers?.map(({ name, slot, wear }) => [name, slot, wear]),
    item.charms?.map(({ name, pattern }) => [name, pattern]),
    item.floatValue === undefined ? item.assetId ?? item.inspectLink : undefined,
  ]);
}

export function highestBuyOrder(body: unknown): number | undefined {
  const orders = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(orders)) throw new Error('Unrecognized CSFloat buy-order response.');
  const prices = orders.flatMap((order) => {
    if (!order || typeof order !== 'object') return [];
    const { price, qty } = order as { price?: unknown; qty?: unknown };
    return typeof price === 'number' && Number.isSafeInteger(price) && price > 0 && (qty === undefined || typeof qty === 'number' && qty > 0) ? [price] : [];
  });
  return prices.length ? Math.max(...prices) : undefined;
}

/** What an item sells for on CSFloat right now, as of `fetchedAt`. Keyed by market hash name. */
export interface PriceQuote {
  name: string;
  /** Cheapest buy-now listing; missing when nobody has one listed. */
  priceCents?: number;
  /** CSFloat's own estimate for the item, when it gives one. */
  estimateCents?: number;
  fetchedAt: string;
  instantSell?: Record<string, InstantSellQuote>;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Skin and sticker prices move a few percent a day; a quote this old is still good for judging a hold. */
export const PRICE_TTL_MS = 6 * HOUR_MS;
/** A few percent of an expensive item is real money, so those refresh sooner. */
export const EXPENSIVE_PRICE_TTL_MS = HOUR_MS;
export const EXPENSIVE_CENTS = 100_00;
/** "Refresh prices" skips anything this fresh, so clicking it twice doesn't ask CSFloat twice. */
export const FORCED_MIN_AGE_MS = 5 * MINUTE_MS;
/** After CSFloat says slow down, prices wait this long. */
export const RATE_LIMIT_PAUSE_MS = 30 * MINUTE_MS;
/** Quotes for items no longer held are dropped after this. */
export const PRICE_KEEP_MS = 7 * 24 * HOUR_MS;

export function priceAgeLimit(quote: PriceQuote, force: boolean): number {
  if (force) return FORCED_MIN_AGE_MS;
  return (quote.priceCents ?? 0) >= EXPENSIVE_CENTS ? EXPENSIVE_PRICE_TTL_MS : PRICE_TTL_MS;
}

/** The names worth asking CSFloat about now: never priced, or priced longer ago than their limit. */
export function duePriceNames(names: Iterable<string>, quotes: ReadonlyMap<string, PriceQuote>, now: Date, force = false): string[] {
  return [...new Set(names)].filter((name) => {
    const quote = quotes.get(name);
    return !quote || now.getTime() - Date.parse(quote.fetchedAt) >= priceAgeLimit(quote, force);
  });
}

/** The part of a CSFloat listing the price comes from. */
interface PricedListing {
  price?: number;
  reference?: { predicted_price?: number; base_price?: number };
}

/** Reads the cheapest listing out of a `/listings` response, which is a bare array or `{ data: [...] }`. */
export function quoteFromResponse(name: string, body: unknown, fetchedAt: string): PriceQuote {
  const list = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data;
  const cheapest = (Array.isArray(list) ? list[0] : undefined) as PricedListing | undefined;
  const reference = cheapest?.reference;
  return {
    name,
    priceCents: typeof cheapest?.price === 'number' ? cheapest.price : undefined,
    estimateCents: reference?.predicted_price ?? reference?.base_price,
    fetchedAt,
  };
}
