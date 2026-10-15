import type { Item } from './types';

const WEAR_ABBREVIATIONS: Record<string, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

const WEAR_IN_PARENS = /\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/i;
const WEAR_ABBREVIATION_SUFFIX = /\s*-?\s*\b(FN|MW|FT|WW|BS)\b/i;
const AGENT_SUFFIX = /\s*-\s*(T|CT)\s+Agent\s*$/i;
const FLOAT_NOTE = /\(\s*0?\.\d+\s*\)/;
const APPLIED_STICKER_NOTE = /\s\+\s.*$/;

/**
 * Reduces a skin name to a comparable key, so hand-typed tracker names
 * ("Famas | Teardown - FN", "AK-47 Neon Revolution - FT") line up with
 * CSFloat's market hash names ("FAMAS | Teardown (Factory New)").
 */
export function nameKey(name: string): string {
  let rest = name
    .replace(/★/g, '')
    .replace(APPLIED_STICKER_NOTE, '')
    .replace(FLOAT_NOTE, '')
    .replace(AGENT_SUFFIX, '');

  let wear = '';
  const wearMatch = rest.match(WEAR_IN_PARENS) ?? rest.match(WEAR_ABBREVIATION_SUFFIX);
  if (wearMatch) {
    wear = abbreviateWear(wearMatch[1]);
    rest = rest.replace(wearMatch[0], '');
  }

  const compact = rest.toLowerCase().replace(/[^a-z0-9]/g, '');
  return wear ? `${compact}:${wear}` : compact;
}

/** The tracker's naming style: "AK-47 | Slate - MW". */
export function trackerDisplayName(item: Item): string {
  const name = item.itemName.replace(/^★\s*/, '');
  const wear = item.wearName && WEAR_ABBREVIATIONS[item.wearName];
  return wear ? `${name} - ${wear}` : name;
}

function abbreviateWear(wear: string): string {
  const fullName = Object.keys(WEAR_ABBREVIATIONS).find((full) => full.toLowerCase() === wear.toLowerCase());
  return fullName ? WEAR_ABBREVIATIONS[fullName] : wear.toUpperCase();
}
