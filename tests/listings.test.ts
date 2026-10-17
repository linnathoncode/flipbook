import { buildJournalView } from '../src/domain/journal';
import { filterRows, EMPTY_FILTER, sectionRows } from '../src/domain/listFilters';
import { listedBuys, listingsInResponse, normalizeCsfloatListings, type CsfloatListing, type Listing } from '../src/domain/listings';
import { skin, sticker, trade } from './builders';

const NOW = new Date('2026-10-15T12:00:00Z');

const raw = (id: string, price: number, item: CsfloatListing['item'], extra: Partial<CsfloatListing> = {}): CsfloatListing => ({
  id,
  created_at: '2026-10-14T00:00:00Z',
  type: 'buy_now',
  state: 'listed',
  price,
  item,
  ...extra,
});

const listing = (item: Listing['item'], priceCents: number): Listing => ({ id: `l${priceCents}`, priceCents, listedAt: '2026-10-14T00:00:00Z', auction: false, item });

describe('reading listings from CSFloat', () => {
  const item = { market_hash_name: 'Sticker | Crown (Foil)', type: 'sticker' };

  it('takes a bare array or a { data } page, and skips anything that is not a listing', () => {
    expect(listingsInResponse([raw('1', 100, item)])).toHaveLength(1);
    expect(listingsInResponse({ data: [raw('1', 100, item), { nope: true }] })).toHaveLength(1);
    expect(listingsInResponse({ error: 'x' })).toEqual([]);
    expect(listingsInResponse(null)).toEqual([]);
  });

  it('keeps only live listings and marks auctions', () => {
    const listings = normalizeCsfloatListings([raw('1', 100, item), raw('2', 200, item, { state: 'sold' }), raw('3', 300, item, { type: 'auction' })]);
    expect(listings.map((entry) => [entry.id, entry.auction])).toEqual([['1', false], ['3', true]]);
  });
});

describe('listedBuys', () => {
  it('matches a skin by its float fingerprint', () => {
    const buy = trade('buy', skin({ floatValue: 0.0525 }), '2026-10-01');
    const other = trade('buy', skin({ floatValue: 0.3 }), '2026-10-02');
    const listed = listedBuys([buy, other], [listing(skin({ floatValue: 0.0525 }), 815)]);
    expect([...listed.keys()]).toEqual([buy.id]);
  });

  it('matches float-less items by name, oldest buy first, one listing per buy', () => {
    const older = trade('buy', sticker('Sticker | Crown (Foil)'), '2026-09-01');
    const newer = trade('buy', sticker('Sticker | Crown (Foil)'), '2026-10-01');
    const listed = listedBuys([newer, older], [listing(sticker('Sticker | Crown (Foil)'), 500), listing(sticker('Sticker | Crown (Foil)'), 600)]);
    expect(listed.get(older.id)?.priceCents).toBe(500);
    expect(listed.get(newer.id)?.priceCents).toBe(600);
  });

  it('leaves buys alone when nothing listed matches', () => {
    const buy = trade('buy', sticker('Sticker | Crown (Foil)'), '2026-09-01');
    expect(listedBuys([buy], [listing(sticker('Sticker | Titan'), 500)]).size).toBe(0);
  });
});

describe('listed rows', () => {
  it('shows what an open buy nets at its asking price, and can be filtered', () => {
    const buy = trade('buy', sticker('Sticker | Crown (Foil)'), '2026-10-01', 1000);
    const held = trade('buy', sticker('Sticker | Titan'), '2026-10-02', 1000);
    const view = buildJournalView([buy, held], [], 0);
    const listed = listedBuys(view.openBuys, [listing(sticker('Sticker | Crown (Foil)'), 1500)]);
    const rows = sectionRows({ flips: view.flips, openBuys: view.openBuys, sales: [] }, 0.02, NOW, { listed });

    const row = rows.find((entry) => entry.buy?.id === buy.id)!;
    expect(row.listing!.price).toBe(15);
    expect(row.listing!.net).toBeCloseTo(4.7);
    expect(row.listing!.percent).toBeCloseTo(47);
    expect(filterRows(rows, { ...EMPTY_FILTER, result: 'listed' })).toEqual([row]);
  });
});
