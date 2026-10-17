import { buildJournalView } from '../src/domain/journal';
import { EMPTY_FILTER, filterRows, pickResult, sectionRows, sortRows, toggleExcludedKind, toggleExcludedResult, toggleKind, totalRows, type SheetRow } from '../src/domain/listFilters';
import { skin, sticker, trade } from './builders';

const NOW = new Date('2026-10-15T12:00:00Z');

function rowsFor() {
  const winBuy = trade('buy', skin({ floatValue: 0.2 }), '2026-10-01T00:00:00Z', 1000);
  const winSell = trade('sell', skin({ floatValue: 0.2 }), '2026-10-11T00:00:00Z', 1500);
  const awp = skin({ marketHashName: 'AWP | Black Box (Minimal Wear)', itemName: 'AWP | Black Box', defIndex: 9, paintIndex: 1, floatValue: 0.09 });
  const lossBuy = trade('buy', awp, '2026-01-01T00:00:00Z', 1000);
  const lossSell = trade('sell', awp, '2026-02-01T00:00:00Z', 900);
  const open = trade('buy', sticker(), '2026-10-14T00:00:00Z', 50);
  const orphan = trade('sell', sticker('Sticker | Crown (Foil)'), '2026-10-13T00:00:00Z', 200);
  const view = buildJournalView([winBuy, winSell, lossBuy, lossSell, open, orphan], [], 0);
  const section = { flips: view.flips, openBuys: view.openBuys, sales: view.unmatchedSells };
  const rows = sectionRows(section, 0.02, NOW);
  const byBuy = (id: string) => rows.find((row) => row.buy?.id === id)!;
  return { rows, win: byBuy(winBuy.id), loss: byBuy(lossBuy.id), open: byBuy(open.id), orphan: rows.find((row) => row.status === 'sale')! };
}

const keys = (rows: SheetRow[]) => rows.map((row) => row.key);

describe('sectionRows', () => {
  it('works out each row once: closed flips, open buys and sales with no buy', () => {
    const { win, open, orphan } = rowsFor();
    expect(win).toMatchObject({ status: 'closed', buyPrice: 10, sellPrice: 15, net: 5, held: 10 });
    expect(open).toMatchObject({ status: 'open', buyPrice: 0.5, held: 1 });
    expect(open.net).toBeUndefined();
    expect(orphan).toMatchObject({ status: 'sale', sellPrice: 2, fee: 0.04 });
  });
});

describe('filterRows', () => {
  it('returns everything for an empty filter', () => {
    const { rows } = rowsFor();
    expect(filterRows(rows, EMPTY_FILTER)).toHaveLength(4);
  });

  it('searches by name, case-insensitively', () => {
    const { rows, loss } = rowsFor();
    expect(keys(filterRows(rows, { ...EMPTY_FILTER, query: 'black box' }))).toEqual([loss.key]);
  });

  it('filters by kind of item', () => {
    const { rows, loss } = rowsFor();
    expect(keys(filterRows(rows, { ...EMPTY_FILTER, kinds: ['sniper'] }))).toEqual([loss.key]);
    expect(filterRows(rows, { ...EMPTY_FILTER, kinds: ['sticker'] })).toHaveLength(2);
  });

  it('filters by result', () => {
    const { rows, win, loss, open } = rowsFor();
    expect(keys(filterRows(rows, { ...EMPTY_FILTER, result: 'win' }))).toEqual([win.key]);
    expect(keys(filterRows(rows, { ...EMPTY_FILTER, result: 'loss' }))).toEqual([loss.key]);
    expect(keys(filterRows(rows, { ...EMPTY_FILTER, result: 'open' }))).toEqual([open.key]);
  });

  it('hides right-clicked kinds and results', () => {
    const { rows, win, loss, open } = rowsFor();
    expect(keys(filterRows(rows, toggleExcludedKind(EMPTY_FILTER, 'sticker')))).toEqual([win.key, loss.key]);
    expect(keys(filterRows(rows, toggleExcludedResult(EMPTY_FILTER, 'open')))).not.toContain(open.key);
    const noLosses = toggleExcludedResult(pickResult(EMPTY_FILTER, 'loss'), 'loss');
    expect(noLosses.result).toBe('all');
    expect(keys(filterRows(rows, noLosses))).not.toContain(loss.key);
  });

  it('switches a chip between picked and hidden', () => {
    const hidden = toggleExcludedKind(toggleKind(EMPTY_FILTER, 'sticker'), 'sticker');
    expect(hidden).toMatchObject({ kinds: [], excludedKinds: ['sticker'] });
    expect(toggleKind(hidden, 'sticker')).toMatchObject({ kinds: ['sticker'], excludedKinds: [] });
    expect(toggleExcludedResult(EMPTY_FILTER, 'all')).toBe(EMPTY_FILTER);
  });
});

describe('sortRows', () => {
  it('puts the newest buys on top, with sales placed by when they sold', () => {
    const { rows, win, loss, open, orphan } = rowsFor();
    expect(keys(sortRows(rows, { key: 'bought', descending: true }))).toEqual([open.key, orphan.key, win.key, loss.key]);
  });

  it('keeps open buys on top when sorted by buy date, even ones older than a closed flip', () => {
    const oldOpen = trade('buy', sticker('Aces High Pin'), '2026-08-10T00:00:00Z', 584);
    const flipBuy = trade('buy', skin(), '2026-10-05T00:00:00Z', 765);
    const flipSell = trade('sell', skin(), '2026-10-13T00:00:00Z', 815);
    const view = buildJournalView([oldOpen, flipBuy, flipSell], [], 0);
    const rows = sectionRows({ flips: view.flips, openBuys: view.openBuys, sales: view.unmatchedSells }, 0.02, NOW);
    for (const descending of [true, false]) {
      expect(sortRows(rows, { key: 'bought', descending }).map((row) => row.status)).toEqual(['open', 'closed']);
    }
  });

  it('sinks rows with no value for the column', () => {
    const { rows, win, loss } = rowsFor();
    const sorted = sortRows(rows, { key: 'net', descending: true });
    expect(keys(sorted).slice(0, 2)).toEqual([win.key, loss.key]);
  });

  it('sorts by float and by float within the skin range', () => {
    const { rows, win, loss } = rowsFor();
    // The AWP's 0.09 is lower than 0.2, but AWP | paint 1 isn't in the table, so both span 0 to 1.
    expect(keys(sortRows(rows, { key: 'float', descending: false })).slice(0, 2)).toEqual([loss.key, win.key]);
    expect(keys(sortRows(rows, { key: 'adjusted', descending: false })).slice(0, 2)).toEqual([loss.key, win.key]);
  });
});

describe('totalRows', () => {
  it('totals every row and weights the percent by what the closed flips cost', () => {
    const { rows } = rowsFor();
    const totals = totalRows(rows);
    expect(totals).toMatchObject({ rows: 4, closed: 2, buy: 20.5, sell: 26, net: 4 });
    expect(totals.weightedPercent).toBeCloseTo(20);
  });

  it('leaves totals blank when nothing has that figure', () => {
    const { open } = rowsFor();
    expect(totalRows([open])).toMatchObject({ sell: undefined, net: undefined, weightedPercent: undefined });
  });
});
