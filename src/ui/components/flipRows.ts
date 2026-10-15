import type { FlipSortKey, Sort } from '../../domain/listFilters';
import type { Flip } from '../../domain/profit';
import type { MatchConfidence } from '../../domain/types';
import { entryKey, type ViewMode } from '../places';
import type { Entry, Selection } from '../useSelection';

/** What both flip layouts (ledger and sheet) share. */
export interface FlipListProps {
  flips: Flip[];
  mode: ViewMode;
  sort: Sort<FlipSortKey>;
  onSort: (sort: Sort<FlipSortKey>) => void;
  selection: Selection;
  onChange: () => void;
}

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
