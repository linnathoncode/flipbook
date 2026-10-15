import {
  EMPTY_FILTER,
  filterFlips,
  filterHoldings,
  itemKind,
  sortFlips,
  sortHoldings,
} from '../src/domain/listFilters';
import { buildFlip, heldDays, type Flip } from '../src/domain/profit';
import type { Item, Trade } from '../src/domain/types';
import { skin, sticker, trade } from './builders';

const NOW = new Date('2026-10-15T12:00:00Z');

function flip(item: Item, boughtAt: string, soldAt: string, buyCents: number, sellCents: number): Flip {
  const buy = trade('buy', item, boughtAt, buyCents);
  const sell = trade('sell', item, soldAt, sellCents);
  return buildFlip({ sellId: sell.id, buyId: buy.id, confidence: 'exact' }, buy, sell, 0);
}

const winner = flip(skin(), '2026-10-01T00:00:00Z', '2026-10-11T00:00:00Z', 1000, 1500);
const loser = flip(skin({ marketHashName: 'AWP | Black Box (Minimal Wear)' }), '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', 1000, 900);
const caseFlip = flip({ ...sticker('Recoil Case'), type: 'container' }, '2026-10-12T00:00:00Z', '2026-10-14T00:00:00Z', 30, 40);

describe('filterFlips', () => {
  const all = [winner, loser, caseFlip];

  it('returns everything for an empty filter', () => {
    expect(filterFlips(all, EMPTY_FILTER, NOW)).toEqual(all);
  });

  it('searches by name, case-insensitively', () => {
    expect(filterFlips(all, { ...EMPTY_FILTER, query: 'black box' }, NOW)).toEqual([loser]);
  });

  it('filters by item kind', () => {
    expect(filterFlips(all, { ...EMPTY_FILTER, kinds: ['case'] }, NOW)).toEqual([caseFlip]);
  });

  it('filters by result', () => {
    expect(filterFlips(all, { ...EMPTY_FILTER, result: 'loss' }, NOW)).toEqual([loser]);
    expect(filterFlips(all, { ...EMPTY_FILTER, result: 'profit' }, NOW)).toEqual([winner, caseFlip]);
  });

  it('filters by when the item was sold', () => {
    expect(filterFlips(all, { ...EMPTY_FILTER, period: '7d' }, NOW)).toEqual([winner, caseFlip]);
  });

  it('filters by match type', () => {
    expect(filterFlips(all, { ...EMPTY_FILTER, matches: ['fifo'] }, NOW)).toEqual([]);
  });
});

describe('sortFlips', () => {
  it('sorts by net profit in either direction', () => {
    expect(sortFlips([winner, loser, caseFlip], { key: 'net', descending: true })).toEqual([winner, caseFlip, loser]);
    expect(sortFlips([winner, loser, caseFlip], { key: 'net', descending: false })).toEqual([loser, caseFlip, winner]);
  });

  it('sorts by hold time and sinks unknown hold times', () => {
    const untracked = { ...winner, sell: { ...winner.sell, source: 'xlsx' as const } };
    expect(heldDays(untracked)).toBeUndefined();
    expect(sortFlips([untracked, caseFlip, loser], { key: 'held', descending: true })).toEqual([loser, caseFlip, untracked]);
  });
});

describe('holdings', () => {
  const old: Trade = trade('buy', skin(), '2025-01-01T00:00:00Z', 500);
  const recent: Trade = trade('buy', sticker(), '2026-10-10T00:00:00Z', 20);

  it('filters by kind and period', () => {
    expect(filterHoldings([old, recent], { ...EMPTY_FILTER, kinds: ['sticker'] }, NOW)).toEqual([recent]);
    expect(filterHoldings([old, recent], { ...EMPTY_FILTER, period: '30d' }, NOW)).toEqual([recent]);
  });

  it('sorts by price', () => {
    expect(sortHoldings([recent, old], { key: 'buyPrice', descending: true })).toEqual([old, recent]);
  });
});

describe('itemKind', () => {
  it('groups CSFloat item types the way traders think of them', () => {
    expect(itemKind({ ...sticker(), type: 'patch' })).toBe('sticker');
    expect(itemKind({ ...sticker(), type: 'container' })).toBe('case');
    expect(itemKind({ ...sticker(), type: 'collectible' })).toBe('other');
  });
});
