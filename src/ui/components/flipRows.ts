import type { Flip } from '../../domain/profit';
import type { MatchConfidence } from '../../domain/types';
import { entryKey } from '../places';
import type { Entry } from '../useSelection';

export const CONFIDENCE: Record<MatchConfidence, { label: string; hint: string }> = {
  exact: { label: 'Exact', hint: 'Same float, seed and pattern' },
  fifo: { label: 'FIFO', hint: 'Interchangeable item, oldest buy closed first' },
  suggested: { label: 'Check', hint: 'Only same-name buy found. Probably right, worth a look' },
  tracker: { label: 'Tracker', hint: 'Paired on a row of your spreadsheet' },
  manual: { label: 'Manual', hint: 'You chose this pairing' },
};

/** Moving a flip moves both its trades. */
export function flipEntry(flip: Flip): Entry {
  return { key: entryKey.flip(flip.sell.id), tradeIds: [flip.sell.id, flip.buy.id] };
}
