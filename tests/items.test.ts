import { normalizeCsfloatTrades, type CsfloatTrade } from '../src/domain/csfloatTrades';
import { adjustedFloat, floatRange } from '../src/domain/floatRanges';
import { itemKind } from '../src/domain/itemKinds';
import { skin, sticker } from './builders';

describe('floatRange', () => {
  it('knows skins with a capped range', () => {
    // AK-47 | Asiimov (def 7, paint 801) drops between 0.05 and 0.70.
    expect(floatRange(skin({ defIndex: 7, paintIndex: 801, floatValue: 0.3 }))).toEqual({ min: 0.05, max: 0.7 });
  });

  it('falls back to 0 to 1 for skins that span the whole range', () => {
    expect(floatRange(skin({ defIndex: 7, paintIndex: 99999 }))).toEqual({ min: 0, max: 1 });
  });

  it('has nothing for items without a float', () => {
    expect(floatRange(sticker())).toBeUndefined();
  });
});

describe('adjustedFloat', () => {
  it('places the float inside the skin range', () => {
    expect(adjustedFloat(skin({ defIndex: 7, paintIndex: 801, floatValue: 0.375 }))).toBeCloseTo(0.5);
  });

  it('equals the float when the range is 0 to 1', () => {
    expect(adjustedFloat(skin({ defIndex: 7, paintIndex: 99999, floatValue: 0.25 }))).toBeCloseTo(0.25);
  });
});

describe('itemKind', () => {
  it('splits skins by weapon class', () => {
    expect(itemKind(skin({ defIndex: 7 }))).toBe('rifle');
    expect(itemKind(skin({ defIndex: 9 }))).toBe('sniper');
    expect(itemKind(skin({ defIndex: 4 }))).toBe('pistol');
    expect(itemKind(skin({ defIndex: 519, isStarred: true }))).toBe('knife');
    expect(itemKind(skin({ defIndex: 5030, isStarred: true }))).toBe('gloves');
  });

  it('groups the rest by what CSFloat calls them', () => {
    expect(itemKind({ ...sticker(), type: 'patch' })).toBe('sticker');
    expect(itemKind({ ...sticker(), type: 'container' })).toBe('case');
    expect(itemKind({ ...sticker(), type: 'collectible' })).toBe('other');
  });
});

describe('accessories from CSFloat', () => {
  it('reads stickers, charms and fade', () => {
    const raw: CsfloatTrade = {
      id: '1',
      created_at: '2026-10-01T00:00:00Z',
      state: 'verified',
      buyer_id: 'me',
      seller_id: 'them',
      contract: {
        price: 1000,
        item: {
          market_hash_name: 'Glock-18 | Fade (Factory New)',
          type: 'skin',
          float_value: 0.02,
          stickers: [{ name: 'Sticker | Crown (Foil)', slot: 2, icon_url: 'https://example.test/crown.png', wear: 0.1 }, { slot: 3 }],
          keychains: [{ name: "Charm | Lil' Zen", pattern: 65620 }],
          fade: { percentage: 96.4 },
        },
      },
    };
    const [trade] = normalizeCsfloatTrades([raw], 'me');
    expect(trade.item.stickers).toEqual([{ name: 'Sticker | Crown (Foil)', slot: 2, iconUrl: 'https://example.test/crown.png', wear: 0.1 }]);
    expect(trade.item.charms).toEqual([{ name: "Charm | Lil' Zen", pattern: 65620, iconUrl: undefined }]);
    expect(trade.item.fadePercent).toBe(96.4);
  });
});
