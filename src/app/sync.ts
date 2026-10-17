import { detectOwnerSteamId, normalizeCsfloatTrades, type CsfloatTrade } from '../domain/csfloatTrades';
import { HOLDS_ID } from '../domain/folders';
import { listingsInResponse, normalizeCsfloatListings } from '../domain/listings';
import { duePriceNames, PRICE_KEEP_MS, quoteFromResponse, RATE_LIMIT_PAUSE_MS } from '../domain/prices';
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
      const stored = await storeCsfloatTrades(await session.trades());
      await syncListings(session);
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

export async function storeCsfloatTrades(raw: CsfloatTrade[]): Promise<ImportSummary> {
  const settings = await loadSettings();
  const ownerSteamId = settings.ownerSteamId ?? detectOwnerSteamId(raw);
  if (!ownerSteamId) throw new Error('Could not tell which Steam account these trades belong to.');
  if (!settings.ownerSteamId) await saveSettings({ ...settings, ownerSteamId });

  const existingIds = new Set((await loadTrades()).map((trade) => trade.id));
  const trades = normalizeCsfloatTrades(raw, ownerSteamId);
  await saveTrades(trades);
  return { added: trades.filter((trade) => !existingIds.has(trade.id)).length, total: trades.length };
}

/**
 * Listings are extra: if CSFloat won't give them, the trades still count as synced,
 * the last good snapshot stays, and Settings says what went wrong.
 */
async function syncListings(session: CsfloatSession): Promise<void> {
  const { ownerSteamId } = await loadSettings();
  if (!ownerSteamId) return;
  let listingsError: string | undefined;
  try {
    await replaceListings(normalizeCsfloatListings(listingsInResponse(await session.listings(ownerSteamId))));
  } catch (cause) {
    listingsError = errorText(cause);
  }
  await saveSettings({ ...(await loadSettings()), listingsError });
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
  const due = duePriceNames(held.map((buy) => buy.item.marketHashName), await loadPrices(), now, force);
  if (due.length === 0) return;

  // Each price is saved as it lands, so the sheet fills in row by row instead of all at the end.
  const keepAfter = new Date(now.getTime() - PRICE_KEEP_MS).toISOString();
  const total = due.length;
  onPricing({ done: 0, total });
  try {
    for (const [index, name] of due.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, PRICE_REQUEST_GAP_MS));
      const answer = await session.cheapestListing(name);
      if ('rateLimited' in answer) {
        await saveSettings({ ...(await loadSettings()), pricesPausedUntil: new Date(Date.now() + RATE_LIMIT_PAUSE_MS).toISOString() });
        return;
      }
      if ('body' in answer) await savePrices([quoteFromResponse(name, answer.body, new Date().toISOString())], keepAfter);
      onPricing({ done: index + 1, total });
    }
  } finally {
    onPricing({ done: total, total });
  }
}

export function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
