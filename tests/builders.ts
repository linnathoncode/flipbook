import type { Item, Trade } from '../src/domain/types';

let nextId = 1;

export function skin(overrides: Partial<Item> = {}): Item {
  return {
    marketHashName: 'AK-47 | Slate (Minimal Wear)',
    itemName: 'AK-47 | Slate',
    wearName: 'Minimal Wear',
    type: 'skin',
    defIndex: 7,
    paintIndex: 1035,
    paintSeed: 101,
    floatValue: 0.1234,
    isStatTrak: false,
    isSouvenir: false,
    ...overrides,
  };
}

export function sticker(name = 'Sticker | Lil Ava'): Item {
  return { marketHashName: name, itemName: name, type: 'sticker', isStatTrak: false, isSouvenir: false };
}

export function trade(side: Trade['side'], item: Item, at: string, priceCents = 1000): Trade {
  return { id: `t${nextId++}`, side, state: 'verified', priceCents, at, source: 'csfloat', item };
}
