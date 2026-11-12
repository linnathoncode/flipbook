import { normalizeCsfloatTrades, type CsfloatTrade } from '../domain/csfloatTrades';
import { HOLDS_ID } from '../domain/folders';
import { listingsInResponse, normalizeCsfloatListings } from '../domain/listings';
import { duePriceNames, highestBuyOrder, itemPriceKey, FORCED_MIN_AGE_MS, PRICE_KEEP_MS, quoteFromResponse, RATE_LIMIT_PAUSE_MS, type PriceQuote } from '../domain/prices';
import type { Item } from '../domain/types';
import { loadJournal } from './actions';
import { PRICE_REQUEST_GAP_MS, withCsfloatSession, type CsfloatSession } from '../io/csfloatSync';
import { loadPrices, loadSettings, loadTrades, replaceListings, savePrices, saveSettings, saveTrades } from '../io/journalStore';

export interface ImportSummary {
  added: number;
  total: number;
}

export type SyncOutcome = ({ status: 'synced' } & ImportSummary) | { status: 'skipped' };

/** Older than this, Flipbook syncs on its own the next time it gets the chance. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export interface SyncOptions {
  openTabIfNeeded: boolean;
  /** Re-price held items even if their quotes are younger than usual. */
  forcePrices?: boolean;
}

/** How far a price refresh has got. It's over once `done` reaches `total`. */
export interface PricingProgress {
  done: number;
  total: number;
}

export async function syncFromCsfloat(
  { openTabIfNeeded, forcePrices = false }: SyncOptions,
  onPricing: (progress: PricingProgress) => void = () => undefined,
): Promise<SyncOutcome> {
  try {
    const summary = await withCsfloatSession({ openTabIfNeeded }, async (session) => {
      const ownerSteamId = await session.steamId();
      const stored = await storeCsfloatTrades(await session.trades(), ownerSteamId);
      await syncListings(session, ownerSteamId);
      // Prices are a nice-to-have; each one shows its age, so a missed refresh is visible.
      await refreshHeldPrices(session, forcePrices, onPricing).catch(() => undefined);
      return stored;
    });
    if (!summary) return { status: 'skipped' };
    await saveSettings({ ...(await loadSettings()), lastSyncAt: new Date().toISOString(), lastSyncError: undefined });
    return { status: 'synced', ...summary };
  } catch (cause) {
    await saveSettings({ ...(await loadSettings()), lastSyncError: errorText(cause) });
    throw cause;
  }
}

export async function isSyncStale(now = Date.now()): Promise<boolean> {
  const { lastSyncAt } = await loadSettings();
  return !lastSyncAt || now - Date.parse(lastSyncAt) > STALE_AFTER_MS;
}

async function storeCsfloatTrades(raw: CsfloatTrade[], ownerSteamId: string): Promise<ImportSummary> {
  const settings = await loadSettings();
  const existing = await loadTrades();
  const trades = normalizeCsfloatTrades(raw, ownerSteamId);
  const removedIds = raw
    .filter((trade) => trade.state === 'cancelled' || trade.state === 'failed')
    .filter((trade) => trade.buyer_id === ownerSteamId || trade.seller_id === ownerSteamId)
    .map((trade) => trade.id);
  if (settings.ownerSteamId && settings.ownerSteamId !== ownerSteamId) {
    const refreshedIds = new Set([...trades.map((trade) => trade.id), ...removedIds]);
    // A legacy owner was guessed from trades. Correct it only if every old CSFloat row can be reconciled.
    if (settings.ownerSteamIdVerified || existing.some((trade) => trade.source === 'csfloat' && !refreshedIds.has(trade.id))) {
      throw new Error('This journal belongs to a different Steam account. Sign back in to that account on CSFloat and sync again.');
    }
  }
  await saveTrades(trades, removedIds);
  if (!settings.ownerSteamIdVerified) {
    await saveSettings({ ...(await loadSettings()), ownerSteamId, ownerSteamIdVerified: true });
  }
  const existingIds = new Set(existing.map((trade) => trade.id));
  return { added: trades.filter((trade) => !existingIds.has(trade.id)).length, total: trades.length };
}

/**
 * Listings are extra: if CSFloat won't give them, the trades still count as synced,
 * the last good snapshot stays, and Settings says what went wrong.
 */
async function syncListings(session: CsfloatSession, ownerSteamId: string): Promise<void> {
  let listingsError: string | undefined;
  try {
    await replaceListings(normalizeCsfloatListings(listingsInResponse(await session.listings(ownerSteamId))));
  } catch (cause) {
    listingsError = errorText(cause);
  }
  await saveSettings({ ...(await loadSettings()), listingsError });
}

export async function priceItemFromCsfloat(item: Item | string): Promise<PriceQuote> {
  const name = typeof item === 'string' ? item : item.marketHashName;
  const now = new Date();
  const quotes = await loadPrices();
  const bid = typeof item === 'string' ? undefined : quotes.get(name)?.instantSell?.[itemPriceKey(item)];
  if (duePriceNames([name], quotes, now, true).length === 0 && (typeof item === 'string' || bid?.status === 'matched' && now.getTime() - Date.parse(bid.fetchedAt) < FORCED_MIN_AGE_MS)) return quotes.get(name)!;
  const { pricesPausedUntil } = await loadSettings();
  if (pricesPausedUntil && Date.parse(pricesPausedUntil) > now.getTime()) {
    throw new Error('CSFloat paused price lookups. Try again in a little while.');
  }

  const keepAfter = new Date(now.getTime() - PRICE_KEEP_MS).toISOString();
  const journal = typeof item === 'string' ? undefined : await loadJournal();
  const listed = journal && [...journal.listed.values()].find((listing) => itemPriceKey(listing.item) === itemPriceKey(item as Item));
  const result = await withCsfloatSession({ openTabIfNeeded: true }, (session) => lookupPrice(session, name, keepAfter,
    typeof item === 'string' ? [] : [{ item, listingId: listed?.id }]));
  if (result === 'rateLimited') throw new Error('CSFloat paused price lookups for 30 minutes.');
  if (!result || result === 'failed') throw new Error('Could not get a price from CSFloat. Try again.');
  return result;
}

async function lookupPrice(session: CsfloatSession, name: string, keepAfter: string, items: { item: Item; listingId?: string }[] = []): Promise<PriceQuote | 'rateLimited' | 'failed'> {
  const answer = await session.cheapestListing(name);
  if ('rateLimited' in answer) {
    await saveSettings({ ...(await loadSettings()), pricesPausedUntil: new Date(Date.now() + RATE_LIMIT_PAUSE_MS).toISOString() });
    return 'rateLimited';
  }
  if ('failed' in answer) return 'failed';
  const quote = quoteFromResponse(name, answer.body, new Date().toISOString());
  quote.instantSell = { ...(await loadPrices()).get(name)?.instantSell };
  await savePrices([quote], keepAfter);
  for (const { item, listingId } of items) {
    await new Promise((resolve) => setTimeout(resolve, PRICE_REQUEST_GAP_MS));
    const listings = Array.isArray(answer.body) ? answer.body : (answer.body as { data?: unknown } | null)?.data;
    const commodityListing = ['sticker', 'patch', 'container'].includes(item.type) && !item.stickers?.length && !item.charms?.length && Array.isArray(listings) ? listings[0]?.id : undefined;
    const orders = await session.matchingBuyOrders(item, listingId ?? commodityListing);
    if ('rateLimited' in orders) {
      await saveSettings({ ...(await loadSettings()), pricesPausedUntil: new Date(Date.now() + RATE_LIMIT_PAUSE_MS).toISOString() });
      return 'rateLimited';
    }
    let priceCents: number | undefined;
    let status: 'matched' | 'unavailable' = 'unavailable';
    if ('body' in orders) {
      try {
        priceCents = highestBuyOrder(orders.body);
        status = 'matched';
      } catch { /* An unknown response cannot establish an executable price. */ }
    }
    quote.instantSell[itemPriceKey(item)] = { priceCents, status, fetchedAt: new Date().toISOString() };
    await savePrices([quote], keepAfter);
  }
  return quote;
}

/**
 * Prices what's in Holds, asking CSFloat only about items whose quote has run out.
 * If CSFloat says slow down, whatever came back is kept and prices pause for a while.
 */
async function refreshHeldPrices(session: CsfloatSession, force: boolean, onPricing: (progress: PricingProgress) => void): Promise<void> {
  const now = new Date();
  const { pricesPausedUntil } = await loadSettings();
  if (pricesPausedUntil && Date.parse(pricesPausedUntil) > now.getTime()) return;

  const journal = await loadJournal();
  const held = journal.shelved.folders.get(HOLDS_ID)?.openBuys ?? [];
  const cached = await loadPrices();
  const due = duePriceNames(held.map((buy) => buy.item.marketHashName), cached, now, force);
  if (due.length === 0) return;

  // Each price is saved as it lands, so the sheet fills in row by row instead of all at the end.
  const keepAfter = new Date(now.getTime() - PRICE_KEEP_MS).toISOString();
  const total = due.length;
  onPricing({ done: 0, total });
  try {
    for (const [index, name] of due.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, PRICE_REQUEST_GAP_MS));
      if (await lookupPrice(session, name, keepAfter) === 'rateLimited') return;
      onPricing({ done: index + 1, total });
    }
  } finally {
    onPricing({ done: total, total });
  }
}

export function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
