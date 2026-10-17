import { buildJournalView } from '../src/domain/journal';
import { sectionRows } from '../src/domain/listFilters';
import { duePriceNames, quoteFromResponse, type PriceQuote } from '../src/domain/prices';
import { sticker, trade } from './builders';

const NOW = new Date('2026-10-18T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3600_000).toISOString();
const quote = (name: string, priceCents: number, fetchedAt: string): PriceQuote => ({ name, priceCents, fetchedAt });

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
