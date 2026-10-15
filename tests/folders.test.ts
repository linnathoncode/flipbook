import { shelve } from '../src/domain/folders';
import { buildJournalView } from '../src/domain/journal';
import { sticker, trade } from './builders';

const CASES = { id: 'cases', name: 'Cases' };

describe('shelve', () => {
  const setup = () => {
    const buy = trade('buy', sticker('Recoil Case'), '2026-01-01');
    const sell = trade('sell', sticker('Recoil Case'), '2026-01-02');
    const held = trade('buy', sticker('Kilowatt Case'), '2026-01-03');
    const orphanSell = trade('sell', sticker('Dreams & Nightmares Case'), '2026-01-04');
    const view = buildJournalView([buy, sell, held, orphanSell], [], 0.02);
    return { buy, sell, held, orphanSell, view };
  };

  it('keeps everything in the book when nothing is placed', () => {
    const { view } = setup();
    const { book, folders } = shelve(view, new Map(), [CASES]);
    expect([book.flips.length, book.holdings.length, book.unmatched.length]).toEqual([1, 1, 1]);
    expect(folders.get('cases')).toEqual({ flips: [], holdings: [], unmatched: [] });
  });

  it('moves flips, holdings and unmatched sells into their folder', () => {
    const { sell, held, orphanSell, view } = setup();
    const placements = new Map([[sell.id, 'cases'], [held.id, 'cases'], [orphanSell.id, 'cases']]);

    const { book, folders } = shelve(view, placements, [CASES]);

    expect([book.flips.length, book.holdings.length, book.unmatched.length]).toEqual([0, 0, 0]);
    const cases = folders.get('cases')!;
    expect([cases.flips.length, cases.holdings.length, cases.unmatched.length]).toEqual([1, 1, 1]);
  });

  it('keeps a flip in the folder its buy was placed in while held', () => {
    const { buy, view } = setup();
    const { folders } = shelve(view, new Map([[buy.id, 'cases']]), [CASES]);
    expect(folders.get('cases')!.flips).toHaveLength(1);
  });

  it('returns trades to the book when their folder no longer exists', () => {
    const { held, view } = setup();
    const { book } = shelve(view, new Map([[held.id, 'deleted-folder']]), [CASES]);
    expect(book.holdings).toHaveLength(1);
  });
});
