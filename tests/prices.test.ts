import { buildJournalView } from '../src/domain/journal';
import { sectionRows, sortRows, totalRows } from '../src/domain/listFilters';
import { duePriceNames, highestBuyOrder, itemPriceKey, quoteFromResponse, type PriceQuote } from '../src/domain/prices';
import { sticker, trade } from './builders';

const NOW = new Date('2026-10-18T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3600_000).toISOString();
const quote = (name: string, priceCents: number, fetchedAt: string): PriceQuote => ({ name, priceCents, fetchedAt });

describe('item buy-order quotes', () => {
  it('keeps quotes separate for float, seed, finish, and attached accessories', () => {
    const item = { ...sticker('Example'), floatValue: 0.02, paintSeed: 4, paintIndex: 3 };
    for (const other of [
      { ...item, floatValue: 0.03 }, { ...item, paintSeed: 5 }, { ...item, paintIndex: 8 },
      { ...item, charms: [{ name: 'Charm', pattern: 4 }] },
      { ...item, stickers: [{ name: 'Sticker', slot: 0 }] },
    ]) expect(itemPriceKey(other)).not.toBe(itemPriceKey(item));
    expect(itemPriceKey({ ...sticker('Charm'), assetId: 'one' })).not.toBe(itemPriceKey({ ...sticker('Charm'), assetId: 'two' }));
  });

  it('selects the highest active price from server-matched orders', () => {
    expect(highestBuyOrder({ data: [{ price: 100, qty: 2 }, { price: 300, qty: 0 }, { price: 200 }, { price: -1 }, { price: '900' }] })).toBe(200);
    expect(highestBuyOrder([])).toBeUndefined();
    expect(() => highestBuyOrder({ error: 'Denied' })).toThrow();
  });
});

describe('duePriceNames', () => {
  const quotes = new Map([
    ['Cheap', quote('Cheap', 500, hoursAgo(5))],
    ['Stale', quote('Stale', 500, hoursAgo(7))],
    ['Knife', quote('Knife', 50_000, hoursAgo(2))],
    ['Fresh', quote('Fresh', 500, hoursAgo(0.05))],
  ]);

  it('asks about new names and quotes past 6 hours, or past 1 hour for items over $100', () => {
    expect(duePriceNames(['Cheap', 'Stale', 'Knife', 'Fresh', 'New', 'New'], quotes, NOW)).toEqual(['Stale', 'Knife', 'New']);
  });

  it('refreshes everything older than 5 minutes when forced', () => {
    expect(duePriceNames(['Cheap', 'Fresh'], quotes, NOW, true)).toEqual(['Cheap']);
  });
});

describe('quoteFromResponse', () => {
  it('takes the cheapest listing and CSFloat estimate from either response shape', () => {
    const listing = { price: 812, reference: { predicted_price: 790, base_price: 800 } };
    expect(quoteFromResponse('A', [listing], 'now')).toEqual({ name: 'A', priceCents: 812, estimateCents: 790, fetchedAt: 'now' });
    expect(quoteFromResponse('A', { data: [listing] }, 'now').priceCents).toBe(812);
  });

  it('records that nothing is listed, so the name is not asked about again right away', () => {
    expect(quoteFromResponse('A', { data: [] }, 'now')).toEqual({ name: 'A', priceCents: undefined, estimateCents: undefined, fetchedAt: 'now' });
  });
});

describe('priced rows', () => {
  it('shows what an open buy would net at today\'s price', () => {
    const buy = trade('buy', sticker('Sticker | Crown (Foil)'), '2026-10-01', 1000);
    const view = buildJournalView([buy], [], 0);
    const prices = new Map([['Sticker | Crown (Foil)', quote('Sticker | Crown (Foil)', 2000, hoursAgo(1))]]);
    const [row] = sectionRows({ flips: [], openBuys: view.openBuys, sales: [] }, 0.02, NOW, { prices });
    expect(row.quote!.price).toBe(20);
    expect(row.quote!.net).toBeCloseTo(9.6);
    expect(row.net).toBeUndefined();
  });
});

describe('sorting and totals at today\'s price', () => {
  it('sorts open buys by what they would make, and totals what they are worth', () => {
    const cheap = trade('buy', sticker('Sticker | A'), '2026-10-01', 100);
    const dear = trade('buy', sticker('Sticker | B'), '2026-10-02', 100);
    const unpriced = trade('buy', sticker('Sticker | C'), '2026-10-03', 100);
    const view = buildJournalView([cheap, dear, unpriced], [], 0);
    const prices = new Map([
      ['Sticker | A', quote('Sticker | A', 50, hoursAgo(1))],
      ['Sticker | B', quote('Sticker | B', 300, hoursAgo(1))],
    ]);
    const rows = sectionRows({ flips: [], openBuys: view.openBuys, sales: [] }, 0, NOW, { prices });
    const names = sortRows(rows, { key: 'nowNet', descending: true }).map((row) => row.item.marketHashName);
    expect(names).toEqual(['Sticker | B', 'Sticker | A', 'Sticker | C']);
    const totals = totalRows(rows);
    expect(totals.nowPrice).toBeCloseTo(3.5);
    expect(totals.nowNet).toBeCloseTo(1.5);
    expect(totals.nowPercent).toBeCloseTo(75);
  });
});
