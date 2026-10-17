import type { Item } from './types';

/** How traders group what they buy. Skins split by weapon class; everything else by what CSFloat calls it. */
export const ITEM_KINDS = [
  'rifle',
  'sniper',
  'pistol',
  'smg',
  'heavy',
  'knife',
  'gloves',
  'sticker',
  'case',
  'agent',
  'charm',
  'other',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const KIND_PLURAL: Record<ItemKind, string> = {
  rifle: 'Rifles',
  sniper: 'Snipers',
  pistol: 'Pistols',
  smg: 'SMGs',
  heavy: 'Heavy',
  knife: 'Knives',
  gloves: 'Gloves',
  sticker: 'Stickers',
  case: 'Cases',
  agent: 'Agents',
  charm: 'Charms',
  other: 'Other items',
};

const KIND_BY_TYPE: Record<string, ItemKind> = {
  sticker: 'sticker',
  patch: 'sticker',
  container: 'case',
  agent: 'agent',
  charm: 'charm',
  keychain: 'charm',
};

/** CS2 weapon definition indexes by class. */
const WEAPON_CLASSES: [ItemKind, number[]][] = [
  ['pistol', [1, 2, 3, 4, 30, 32, 36, 61, 63, 64]],
  ['rifle', [7, 8, 10, 13, 16, 39, 60]],
  ['sniper', [9, 11, 38, 40]],
  ['smg', [17, 19, 23, 24, 26, 33, 34]],
  ['heavy', [14, 25, 27, 28, 29, 35]],
];
const KIND_BY_WEAPON = new Map(WEAPON_CLASSES.flatMap(([kind, indexes]) => indexes.map((index) => [index, kind] as const)));
const GLOVES_INDEX = 4725;
const FIRST_GLOVES_INDEX = 5027;

export function itemKind(item: Item): ItemKind {
  if (item.type !== 'skin') return KIND_BY_TYPE[item.type] ?? 'other';
  if (item.isStarred) return isGloves(item.defIndex) ? 'gloves' : 'knife';
  return (item.defIndex !== undefined && KIND_BY_WEAPON.get(item.defIndex)) || 'other';
}

function isGloves(defIndex?: number): boolean {
  return defIndex !== undefined && (defIndex === GLOVES_INDEX || defIndex >= FIRST_GLOVES_INDEX);
}
