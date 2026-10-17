import data from './floatRanges.json';
import type { Item } from './types';

/** The lowest and highest float a skin can drop with. */
export interface FloatRange {
  min: number;
  max: number;
}

const FULL_RANGE: FloatRange = { min: 0, max: 1 };
/** "defIndex:paintIndex" → [min, max], for skins that don't span the full 0 to 1. */
const RANGES: Record<string, number[]> = data.ranges;

/** Undefined for items without a float, like stickers and cases. */
export function floatRange(item: Item): FloatRange | undefined {
  if (item.floatValue === undefined) return undefined;
  const known = RANGES[`${item.defIndex}:${item.paintIndex}`];
  return known ? { min: known[0], max: known[1] } : FULL_RANGE;
}

/**
 * Where the float sits inside the skin's own range, 0 at its best and 1 at its worst.
 * Trade-ups average this instead of the raw float since CS2 started scaling outputs by range.
 */
export function adjustedFloat(item: Item): number | undefined {
  const range = floatRange(item);
  if (!range || item.floatValue === undefined) return undefined;
  const span = range.max - range.min;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (item.floatValue - range.min) / span));
}
