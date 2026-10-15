import { shelve, type Folder } from '../domain/folders';
import { buildJournalView } from '../domain/journal';
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
  unlockMatch,
} from '../io/journalStore';

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
  // ExcelJS is most of the bundle, so it's only loaded when a spreadsheet is actually written.
  const { buildTrackerWorkbook } = await import('../io/exportWorkbook');
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
