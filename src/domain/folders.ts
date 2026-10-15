import type { JournalView, UnmatchedEntry } from './journal';
import type { Flip } from './profit';
import type { Trade } from './types';

/** A user-made place to keep trades that aren't flips: cases, long holds, gifts. */
export interface Folder {
  id: string;
  name: string;
}

/** Trade id → folder id. Trades with no placement belong to the main book. */
export type Placements = ReadonlyMap<string, string>;

export interface Section {
  flips: Flip[];
  holdings: Trade[];
  unmatched: UnmatchedEntry[];
}

export interface Shelved {
  book: Section;
  folders: Map<string, Section>;
}

/**
 * Splits the journal into the main book and each folder.
 * A flip follows its sell's folder, else its buy's, so an item set aside
 * while held stays set aside once it's sold.
 */
export function shelve(view: JournalView, placements: Placements, folders: Folder[]): Shelved {
  const book = emptySection();
  const byFolder = new Map(folders.map((folder) => [folder.id, emptySection()]));
  const sectionFor = (...tradeIds: string[]) => {
    const folderId = tradeIds.map((id) => placements.get(id)).find((id) => id !== undefined);
    return (folderId && byFolder.get(folderId)) || book;
  };

  view.flips.forEach((flip) => sectionFor(flip.sell.id, flip.buy.id).flips.push(flip));
  view.openBuys.forEach((buy) => sectionFor(buy.id).holdings.push(buy));
  view.unmatchedSells.forEach((entry) => sectionFor(entry.sell.id).unmatched.push(entry));
  return { book, folders: byFolder };
}

/** Every trade a flip is made of, so moving it moves both halves. */
export function flipTradeIds(flip: Flip): string[] {
  return [flip.sell.id, flip.buy.id];
}

function emptySection(): Section {
  return { flips: [], holdings: [], unmatched: [] };
}
