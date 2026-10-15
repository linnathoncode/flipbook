import { detectOwnerSteamId, normalizeCsfloatTrades, type CsfloatTrade } from '../domain/csfloatTrades';
import { fetchAllCsfloatTrades } from '../io/csfloatSync';
import { loadSettings, loadTrades, saveSettings, saveTrades } from '../io/journalStore';

export interface ImportSummary {
  added: number;
  total: number;
}

export type SyncOutcome = ({ status: 'synced' } & ImportSummary) | { status: 'skipped' };

/** Older than this, Flipbook syncs on its own the next time it gets the chance. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export async function syncFromCsfloat({ openTabIfNeeded }: { openTabIfNeeded: boolean }): Promise<SyncOutcome> {
  try {
    const raw = await fetchAllCsfloatTrades({ openTabIfNeeded });
    if (!raw) return { status: 'skipped' };
    const summary = await storeCsfloatTrades(raw);
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

export function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
