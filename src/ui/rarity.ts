import type { Item } from '../domain/types';

/** CS2's own rarity colors, so a glance at the stripe means the same thing it does in game. */
const RARITY_COLORS: Record<string, string> = {
  'Consumer Grade': '#b0c3d9',
  Base: '#b0c3d9',
  'Industrial Grade': '#5e98d9',
  'Mil-Spec Grade': '#4b69ff',
  'High Grade': '#4b69ff',
  Distinguished: '#4b69ff',
  Restricted: '#8847ff',
  Remarkable: '#8847ff',
  Exceptional: '#8847ff',
  Classified: '#d32ce6',
  Exotic: '#d32ce6',
  Superior: '#d32ce6',
  Covert: '#eb4b4b',
  Extraordinary: '#eb4b4b',
  Master: '#eb4b4b',
  Contraband: '#e4ae39',
};
const STARRED_COLOR = '#e4ae39';

/** Undefined for items with no known rarity, e.g. rows typed into the tracker. */
export function rarityColor(item: Item): string | undefined {
  if (item.isStarred) return STARRED_COLOR;
  return item.rarityName ? RARITY_COLORS[item.rarityName] : undefined;
}
