import {
  detectOwnerSteamId,
  normalizeCsfloatTrades,
  type CsfloatTrade,
  type CsfloatTradesPage,
} from '../domain/csfloatTrades';
import { reconcileTrackerRows } from '../domain/trackerRows';
import { buildJournalView } from '../domain/journal';
import { fetchAllCsfloatTrades } from '../io/csfloatSync';
import {
  loadLockedMatches,
  loadSettings,
  loadTrades,
  lockMatch,
  saveSettings,
  saveTrades,
  unlockMatch,
} from '../io/journalStore';

export interface ImportSummary {
  added: number;
  total: number;
}

export async function syncFromCsfloat(): Promise<ImportSummary> {
  const raw = await fetchAllCsfloatTrades();
  const summary = await storeCsfloatTrades(raw);
  await saveSettings({ ...(await loadSettings()), lastSyncAt: new Date().toISOString() });
  return summary;
}

export async function importTradesJson(file: File): Promise<ImportSummary> {
  const page = JSON.parse(await file.text()) as CsfloatTradesPage;
  if (!Array.isArray(page.trades)) throw new Error('This file is not a CSFloat trades export.');
  return storeCsfloatTrades(page.trades);
}

export async function importTrackerWorkbook(file: File): Promise<ImportSummary> {
  const { readTrackerRows } = await loadSpreadsheetModule('read');
  const rows = await readTrackerRows(await file.arrayBuffer());
  const { newTrades, lockedMatches } = reconcileTrackerRows(rows, await loadTrades());
  await saveTrades(newTrades);
  await Promise.all(lockedMatches.map(lockMatch));
  return { added: newTrades.length, total: rows.length };
}

export async function lockManualMatch(sellId: string, buyId: string): Promise<void> {
  await lockMatch({ sellId, buyId, confidence: 'manual' });
}

export async function releaseManualMatch(sellId: string): Promise<void> {
  await unlockMatch(sellId);
}

export async function loadJournal() {
  const [trades, lockedMatches, settings] = await Promise.all([loadTrades(), loadLockedMatches(), loadSettings()]);
  return { view: buildJournalView(trades, lockedMatches, settings.feeRate), settings };
}

export async function exportWorkbook(): Promise<Blob> {
  const { view, settings } = await loadJournal();
  const { buildTrackerWorkbook } = await loadSpreadsheetModule('write');
  const buffer = await buildTrackerWorkbook({
    flips: view.flips,
    openBuys: view.openBuys,
    defaultFeeRate: settings.feeRate,
  });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function updateFeeRate(feeRate: number): Promise<void> {
  await saveSettings({ ...(await loadSettings()), feeRate });
}

async function storeCsfloatTrades(raw: CsfloatTrade[]): Promise<ImportSummary> {
  const settings = await loadSettings();
  const ownerSteamId = settings.ownerSteamId ?? detectOwnerSteamId(raw);
  if (!ownerSteamId) throw new Error('Could not tell which Steam account these trades belong to.');
  if (!settings.ownerSteamId) await saveSettings({ ...settings, ownerSteamId });

  const existingIds = new Set((await loadTrades()).map((trade) => trade.id));
  const trades = normalizeCsfloatTrades(raw, ownerSteamId);
  await saveTrades(trades);
  return { added: trades.filter((trade) => !existingIds.has(trade.id)).length, total: trades.length };
}

/** ExcelJS is most of the bundle, so it's only loaded when a spreadsheet is actually read or written. */
function loadSpreadsheetModule(mode: 'read'): Promise<typeof import('../io/trackerWorkbook')>;
function loadSpreadsheetModule(mode: 'write'): Promise<typeof import('../io/exportWorkbook')>;
function loadSpreadsheetModule(mode: 'read' | 'write') {
  return mode === 'read' ? import('../io/trackerWorkbook') : import('../io/exportWorkbook');
}
