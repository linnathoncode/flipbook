import { FLIPS_ID, HOLDS_ID, OTHER_ID, shelve, withDefaultFolders, type FolderRule, type ShelveOptions } from '../src/domain/folders';
import { buildJournalView } from '../src/domain/journal';
import { skin, sticker, trade } from './builders';

const CASES = { id: 'cases', name: 'Cases' };
const FOLDERS = withDefaultFolders([CASES]);

const options = (overrides: Partial<ShelveOptions> = {}): ShelveOptions => ({
  placements: new Map(),
  folders: FOLDERS,
  rules: [],
  orphansToOther: true,
  ...overrides,
});

describe('withDefaultFolders', () => {
  it('puts Holds and Other first, then the user folders by name', () => {
    const folders = withDefaultFolders([{ id: 'b', name: 'Zeus cases' }, { id: 'a', name: 'Gifts' }]);
    expect(folders.map((folder) => folder.name)).toEqual(['Holds', 'Other', 'Gifts', 'Zeus cases']);
  });

  it('keeps the default names even if an old copy is stored', () => {
    expect(withDefaultFolders([{ id: HOLDS_ID, name: 'Renamed' }]).map((folder) => folder.name)).toEqual(['Holds', 'Other']);
  });
});

describe('shelve', () => {
  const setup = () => {
    const buy = trade('buy', sticker('Recoil Case'), '2026-01-01');
    const sell = trade('sell', sticker('Recoil Case'), '2026-01-02');
    const held = trade('buy', sticker('Kilowatt Case'), '2026-01-03');
    const orphanSell = trade('sell', sticker('Dreams & Nightmares Case'), '2026-01-04');
    const view = buildJournalView([buy, sell, held, orphanSell], [], 0.02);
    return { buy, sell, held, orphanSell, view };
  };

  it('keeps flips and open buys on the Flips sheet and sends sales with no buy to Other', () => {
    const { view } = setup();
    const { book, folders } = shelve(view, options());
    expect([book.flips.length, book.openBuys.length, book.sales.length]).toEqual([1, 1, 0]);
    expect(folders.get(OTHER_ID)!.sales).toHaveLength(1);
  });

  it('leaves sales with no buy on the Flips sheet when that setting is off', () => {
    const { view } = setup();
    const { book } = shelve(view, options({ orphansToOther: false }));
    expect(book.sales).toHaveLength(1);
  });

  it('moves flips, open buys and sales into the folder they were placed in', () => {
    const { sell, held, orphanSell, view } = setup();
    const placements = new Map([[sell.id, 'cases'], [held.id, 'cases'], [orphanSell.id, 'cases']]);

    const { book, folders } = shelve(view, options({ placements }));

    expect([book.flips.length, book.openBuys.length, book.sales.length]).toEqual([0, 0, 0]);
    const cases = folders.get('cases')!;
    expect([cases.flips.length, cases.openBuys.length, cases.sales.length]).toEqual([1, 1, 1]);
  });

  it('keeps a flip in the folder its buy was placed in while held', () => {
    const { buy, view } = setup();
    const { folders } = shelve(view, options({ placements: new Map([[buy.id, HOLDS_ID]]) }));
    expect(folders.get(HOLDS_ID)!.flips).toHaveLength(1);
  });

  it('lets a sale with no buy be pinned back to Flips', () => {
    const { orphanSell, view } = setup();
    const { book } = shelve(view, options({ placements: new Map([[orphanSell.id, FLIPS_ID]]) }));
    expect(book.sales).toHaveLength(1);
  });

  it('returns trades to the Flips sheet when their folder no longer exists', () => {
    const { held, view } = setup();
    const { book } = shelve(view, options({ placements: new Map([[held.id, 'deleted-folder']]) }));
    expect(book.openBuys).toHaveLength(1);
  });
});

describe('folder rules', () => {
  const rule: FolderRule = { kind: 'sticker', folderId: HOLDS_ID, since: '2026-03-01T00:00:00Z' };
  const oldSticker = trade('buy', sticker(), '2026-02-01T00:00:00Z');
  const newSticker = trade('buy', sticker(), '2026-03-05T00:00:00Z');
  const newSkin = trade('buy', skin(), '2026-03-05T00:00:00Z');
  const view = buildJournalView([oldSticker, newSticker, newSkin], [], 0.02);

  it('sends new buys of the rule kind to its folder and leaves older ones alone', () => {
    const { book, folders } = shelve(view, options({ rules: [rule] }));
    expect(folders.get(HOLDS_ID)!.openBuys).toEqual([newSticker]);
    expect(book.openBuys).toEqual(expect.arrayContaining([oldSticker, newSkin]));
  });

  it('gives way to where the user put a trade', () => {
    const placements = new Map([[newSticker.id, FLIPS_ID]]);
    const { book } = shelve(view, options({ rules: [rule], placements }));
    expect(book.openBuys).toContain(newSticker);
  });
});
