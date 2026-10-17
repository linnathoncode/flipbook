import { FLIPS_ID, isDefaultFolder, shelve, withDefaultFolders, type Folder } from '../domain/folders';
import type { ItemKind } from '../domain/itemKinds';
import { buildJournalView } from '../domain/journal';
import {
  deleteFolder as deleteStoredFolder,
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
  type Settings,
} from '../io/journalStore';

export async function loadJournal() {
  const [trades, lockedMatches, settings, storedFolders, placements] = await Promise.all([
    loadTrades(),
    loadLockedMatches(),
    loadSettings(),
    loadFolders(),
    loadPlacements(),
  ]);
  const view = buildJournalView(trades, lockedMatches, settings.feeRate);
  const folders = withDefaultFolders(storedFolders);
  return {
    settings,
    folders,
    shelved: shelve(view, { placements, folders, rules: settings.rules, orphansToOther: settings.orphansToOther }),
    /** Sales more than one buy could be. Wherever they're filed, only the user can pair them. */
    review: view.unmatchedSells.filter((entry) => entry.reason === 'ambiguous'),
  };
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
  if (isDefaultFolder(folder.id)) return;
  await saveFolder({ ...folder, name: name.trim() });
}

/** Its trades go back to where Flipbook would file them, and its rules go with it. */
export async function deleteFolder(folderId: string): Promise<void> {
  if (isDefaultFolder(folderId)) return;
  await deleteStoredFolder(folderId);
  await updateSettings((settings) => ({ rules: settings.rules.filter((rule) => rule.folderId !== folderId) }));
}

/** A null folder means the Flips sheet. */
export async function moveTrades(tradeIds: string[], folderId: string | null): Promise<void> {
  await placeTrades(tradeIds, folderId ?? FLIPS_ID);
}

/** One rule per kind: a new rule for stickers replaces the old one. */
export async function addRule(kind: ItemKind, folderId: string): Promise<void> {
  await updateSettings((settings) => ({
    rules: [...settings.rules.filter((rule) => rule.kind !== kind), { kind, folderId, since: new Date().toISOString() }],
  }));
}

export async function removeRule(kind: ItemKind): Promise<void> {
  await updateSettings((settings) => ({ rules: settings.rules.filter((rule) => rule.kind !== kind) }));
}

export async function setOrphansToOther(orphansToOther: boolean): Promise<void> {
  await updateSettings(() => ({ orphansToOther }));
}

export async function updateFeeRate(feeRate: number): Promise<void> {
  await updateSettings(() => ({ feeRate }));
}

/** Exports the Flips sheet only: folders hold what isn't part of the flip record. */
export async function exportWorkbook(): Promise<Blob> {
  const { shelved, settings } = await loadJournal();
  // ExcelJS is most of the bundle, so it's only loaded when a spreadsheet is actually written.
  const { buildTrackerWorkbook } = await import('../io/exportWorkbook');
  const buffer = await buildTrackerWorkbook({
    flips: shelved.book.flips,
    openBuys: shelved.book.openBuys,
    defaultFeeRate: settings.feeRate,
  });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function updateSettings(change: (settings: Settings) => Partial<Settings>): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, ...change(settings) });
}
