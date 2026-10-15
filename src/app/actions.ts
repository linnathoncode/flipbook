import type { CsfloatTradesPage } from '../domain/csfloatTrades';
import { shelve, type Folder } from '../domain/folders';
import { buildJournalView } from '../domain/journal';
import { reconcileTrackerRows } from '../domain/trackerRows';
import {
  deleteFolder,
  loadFolders,
  loadLockedMatches,
  loadPlacements,
  loadSettings,
  loadTrades,
  lockMatch,
  placeTrades,
  saveFolder,
  saveSettings,
  saveTrades,
  unlockMatch,
} from '../io/journalStore';
import { storeCsfloatTrades, type ImportSummary } from './sync';

export type { ImportSummary };

export async function loadJournal() {
  const [trades, lockedMatches, settings, folders, placements] = await Promise.all([
    loadTrades(),
    loadLockedMatches(),
    loadSettings(),
    loadFolders(),
    loadPlacements(),
  ]);
  const view = buildJournalView(trades, lockedMatches, settings.feeRate);
  const sortedFolders = folders.sort((a, b) => a.name.localeCompare(b.name));
  return { settings, folders: sortedFolders, shelved: shelve(view, placements, sortedFolders) };
}

export type Journal = Awaited<ReturnType<typeof loadJournal>>;

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

export async function createFolder(name: string): Promise<Folder> {
  const folder = { id: crypto.randomUUID(), name: name.trim() };
  await saveFolder(folder);
  return folder;
}

export async function renameFolder(folder: Folder, name: string): Promise<void> {
  await saveFolder({ ...folder, name: name.trim() });
}

export { deleteFolder };

/** A null folder moves the trades back into the main book. */
export async function moveTrades(tradeIds: string[], folderId: string | null): Promise<void> {
  await placeTrades(tradeIds, folderId);
}

/** Exports the main book only: folders hold what isn't part of the flip record. */
export async function exportWorkbook(): Promise<Blob> {
  const { shelved, settings } = await loadJournal();
  const { buildTrackerWorkbook } = await loadSpreadsheetModule('write');
  const buffer = await buildTrackerWorkbook({
    flips: shelved.book.flips,
    openBuys: shelved.book.holdings,
    defaultFeeRate: settings.feeRate,
  });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function updateFeeRate(feeRate: number): Promise<void> {
  await saveSettings({ ...(await loadSettings()), feeRate });
}

/** ExcelJS is most of the bundle, so it's only loaded when a spreadsheet is actually read or written. */
function loadSpreadsheetModule(mode: 'read'): Promise<typeof import('../io/trackerWorkbook')>;
function loadSpreadsheetModule(mode: 'write'): Promise<typeof import('../io/exportWorkbook')>;
function loadSpreadsheetModule(mode: 'read' | 'write') {
  return mode === 'read' ? import('../io/trackerWorkbook') : import('../io/exportWorkbook');
}
