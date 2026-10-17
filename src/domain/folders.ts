import { itemKind, type ItemKind } from './itemKinds';
import type { JournalView, UnmatchedEntry } from './journal';
import type { Flip } from './profit';
import type { Trade } from './types';

/** A place for trades that aren't part of the flip record: items kept to use, sales with no buy, cases. */
export interface Folder {
  id: string;
  name: string;
}

export const HOLDS_ID = 'holds';
export const OTHER_ID = 'other';
/** A placement that pins a trade to the Flips sheet, overriding rules and Other. */
export const FLIPS_ID = 'flips';

/** Every journal has these two. They can't be renamed or deleted. */
export const DEFAULT_FOLDERS: readonly Folder[] = [
  { id: HOLDS_ID, name: 'Holds' },
  { id: OTHER_ID, name: 'Other' },
];

export function isDefaultFolder(folderId: string): boolean {
  return DEFAULT_FOLDERS.some((folder) => folder.id === folderId);
}

/** The default folders first, then the user's own by name. */
export function withDefaultFolders(stored: Folder[]): Folder[] {
  const custom = stored
    .filter((folder) => !isDefaultFolder(folder.id) && folder.id !== FLIPS_ID)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...DEFAULT_FOLDERS, ...custom];
}

/** Trade id → folder id, as the user placed it. FLIPS_ID means the Flips sheet. */
export type Placements = ReadonlyMap<string, string>;

/** "Always put stickers in Holds": buys of that kind made after `since` start in the folder. */
export interface FolderRule {
  kind: ItemKind;
  folderId: string;
  since: string;
}

export interface Section {
  flips: Flip[];
  /** Bought and not sold yet. */
  openBuys: Trade[];
  /** Sales Flipbook couldn't pair with a buy. */
  sales: UnmatchedEntry[];
}

export interface Shelved {
  /** The Flips sheet. */
  book: Section;
  folders: Map<string, Section>;
}

export interface ShelveOptions {
  placements: Placements;
  folders: Folder[];
  rules: FolderRule[];
  /** Sales with no buy on record go to Other unless the user placed them. */
  orphansToOther: boolean;
}

/**
 * Splits the journal into the Flips sheet and each folder.
 * A trade the user placed stays where they put it. Otherwise new buys follow the folder rules,
 * sales with no buy go to Other, and everything else is on the Flips sheet.
 * A flip follows its sell's folder, else its buy's, so an item set aside while held stays set aside once sold.
 */
export function shelve(view: JournalView, { placements, folders, rules, orphansToOther }: ShelveOptions): Shelved {
  const book = emptySection();
  const byFolder = new Map(folders.map((folder) => [folder.id, emptySection()]));
  const sectionFor = (folderId?: string) => (folderId && byFolder.get(folderId)) || book;

  const ruleFolder = (buy: Trade) =>
    rules.find((rule) => rule.kind === itemKind(buy.item) && buy.at >= rule.since)?.folderId;
  const buyFolder = (buy: Trade) => placements.get(buy.id) ?? ruleFolder(buy);
  const saleFolder = (entry: UnmatchedEntry) =>
    placements.get(entry.sell.id) ?? (orphansToOther && entry.reason === 'no-candidate' ? OTHER_ID : undefined);

  view.flips.forEach((flip) => sectionFor(placements.get(flip.sell.id) ?? buyFolder(flip.buy)).flips.push(flip));
  view.openBuys.forEach((buy) => sectionFor(buyFolder(buy)).openBuys.push(buy));
  view.unmatchedSells.forEach((entry) => sectionFor(saleFolder(entry)).sales.push(entry));
  return { book, folders: byFolder };
}

export function sectionSize(section: Section): number {
  return section.flips.length + section.openBuys.length + section.sales.length;
}

function emptySection(): Section {
  return { flips: [], openBuys: [], sales: [] };
}
