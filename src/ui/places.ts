/** Where the user is in the book. */
export type Place =
  | { kind: 'flips' }
  | { kind: 'holding' }
  | { kind: 'review' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'data' };

export const VIEW_MODES = ['ledger', 'compact', 'sheet'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  ledger: 'Ledger',
  compact: 'Compact',
  sheet: 'Sheet',
};

export function isSamePlace(a: Place, b: Place): boolean {
  if (a.kind === 'folder' && b.kind === 'folder') return a.folderId === b.folderId;
  return a.kind === b.kind;
}

/** Row keys that stay distinct across flips, held items and unpaired sales on one screen. */
export const entryKey = {
  flip: (sellId: string) => `flip:${sellId}`,
  holding: (buyId: string) => `holding:${buyId}`,
  sale: (sellId: string) => `sale:${sellId}`,
};
