import { detectOwnerSteamId, normalizeCsfloatTrades, type CsfloatTrade } from '../domain/csfloatTrades';
import { listingsInResponse, normalizeCsfloatListings } from '../domain/listings';
import { withCsfloatSession, type CsfloatSession } from '../io/csfloatSync';
import { loadSettings, loadTrades, replaceListings, saveSettings, saveTrades } from '../io/journalStore';

export interface ImportSummary {
  added: number;
  total: number;
}

export type SyncOutcome = ({ status: 'synced' } & ImportSummary) | { status: 'skipped' };

/** Older than this, Flipbook syncs on its own the next time it gets the chance. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export async function syncFromCsfloat({ openTabIfNeeded }: { openTabIfNeeded: boolean }): Promise<SyncOutcome> {
  try {
    const summary = await withCsfloatSession({ openTabIfNeeded }, async (session) => {
      const stored = await storeCsfloatTrades(await session.trades());
      await syncListings(session);
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

export function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
