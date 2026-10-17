// Rebuilds src/domain/floatRanges.json from ByMykel/CSGO-API (MIT licensed).
// Run with `npm run float-ranges` after a CS2 update adds new skins.
import { writeFile } from 'node:fs/promises';

const SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';
const OUTPUT = new URL('../src/domain/floatRanges.json', import.meta.url);

const skins = await (await fetch(SOURCE)).json();
const ranges = {};
for (const skin of skins) {
  if (skin.min_float == null || skin.max_float == null || !skin.weapon || skin.paint_index == null) continue;
  // Most skins span the full 0 to 1, which is the lookup's fallback anyway.
  if (skin.min_float === 0 && skin.max_float === 1) continue;
  ranges[`${skin.weapon.weapon_id}:${skin.paint_index}`] = [skin.min_float, skin.max_float];
}

const sorted = Object.fromEntries(Object.entries(ranges).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
const file = {
  source: 'https://github.com/ByMykel/CSGO-API',
  license: 'MIT, Copyright (c) 2023 ByMykel',
  ranges: sorted,
};
await writeFile(OUTPUT, JSON.stringify(file) + '\n');
console.log(`Wrote ${Object.keys(sorted).length} float ranges.`);
