/** Which sheet tab is open. */
export type Place =
  | { kind: 'flips' }
  | { kind: 'holding' }
  | { kind: 'review' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'settings' };

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
