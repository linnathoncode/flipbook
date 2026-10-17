/** Which page the sidebar has open. */
export type Place =
  | { kind: 'flips' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'review' }
  | { kind: 'analytics' }
  | { kind: 'settings' };

export function isSamePlace(a: Place, b: Place): boolean {
  if (a.kind === 'folder' && b.kind === 'folder') return a.folderId === b.folderId;
  return a.kind === b.kind;
}

/** Flips and folders are sheets of rows; the rest are pages. */
export function isSheet(place: Place): place is { kind: 'flips' } | { kind: 'folder'; folderId: string } {
  return place.kind === 'flips' || place.kind === 'folder';
}
