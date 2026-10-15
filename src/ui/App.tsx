import { useEffect, useState, type ReactNode } from 'react';
import type { Journal } from '../app/actions';
import type { Folder, Section } from '../domain/folders';
import {
  EMPTY_FILTER,
  filterFlips,
  filterHoldings,
  isUnfiltered,
  sortFlips,
  sortHoldings,
  type FlipSortKey,
  type HoldingSortKey,
  type ListFilter,
  type Sort,
} from '../domain/listFilters';
import { centsToDollars, summarizeSettled } from '../domain/profit';
import { countActiveFilters, FilterDrawer } from './components/FilterDrawer';
import { FlipSheet } from './components/FlipSheet';
import { FolderHeader } from './components/FolderHeader';
import { HoldingSheet } from './components/HoldingSheet';
import { Masthead } from './components/Masthead';
import { ReviewPanel } from './components/ReviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { EmptyState } from './components/shared';
import { SheetTabs, type PlaceCounts } from './components/SheetTabs';
import { FlipSummary, HoldingSummary } from './components/Summary';
import { SelectionActions, Toolbar } from './components/Toolbar';
import type { Place } from './places';
import { useJournal } from './useJournal';
import { useLastVisit } from './useLastVisit';
import { usePreference } from './usePreference';
import { useSelection, type Selection } from './useSelection';
import { useTheme } from './useTheme';

// Newest buys on top, the way the tracker sheet reads. Spreadsheet rows have no sale date to sort by.
const DEFAULT_FLIP_SORT: Sort<FlipSortKey> = { key: 'bought', descending: true };
const DEFAULT_HOLDING_SORT: Sort<HoldingSortKey> = { key: 'bought', descending: true };

/** What every list screen shares: how lists are filtered, sorted and selected. */
interface ListContext {
  filter: ListFilter;
  setFilter: (filter: ListFilter) => void;
  filtersOpen: boolean;
  toggleFilters: () => void;
  flipSort: Sort<FlipSortKey>;
  setFlipSort: (sort: Sort<FlipSortKey>) => void;
  holdingSort: Sort<HoldingSortKey>;
  setHoldingSort: (sort: Sort<HoldingSortKey>) => void;
  selection: Selection;
  folders: Folder[];
  /** Trades after this get a NEW tag. */
  newSince?: string;
  onChange: () => void;
}

export function App() {
  const { journal, error, refresh, sync, syncState } = useJournal();
  const [theme, toggleTheme] = useTheme();
  const lastVisit = useLastVisit();
  const [place, setPlace] = useState<Place>({ kind: 'flips' });
  const [filter, setFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [flipSort, setFlipSort] = usePreference('flip-sort', DEFAULT_FLIP_SORT);
  const [holdingSort, setHoldingSort] = usePreference('holding-sort', DEFAULT_HOLDING_SORT);
  const selection = useSelection();
  useEscapeToClear(selection);

  if (error) return <main className="content"><p className="notice notice-error">{error}</p></main>;
  if (!journal) return <main className="content" aria-busy="true" />;

  const navigate = (next: Place) => {
    selection.clear();
    setPlace(next);
  };

  // A folder deleted elsewhere (or just now) falls back to the book.
  const folder = place.kind === 'folder' ? journal.folders.find((candidate) => candidate.id === place.folderId) : undefined;
  const current: Place = place.kind === 'folder' && !folder ? { kind: 'flips' } : place;
  const list: ListContext = {
    filter,
    setFilter,
    filtersOpen,
    toggleFilters: () => setFiltersOpen(!filtersOpen),
    flipSort,
    setFlipSort,
    holdingSort,
    setHoldingSort,
    selection,
    folders: journal.folders,
    newSince: lastVisit,
    onChange: refresh,
  };
  const { book } = journal.shelved;

  return (
    <div className="app">
      <Masthead
        lastSyncAt={journal.settings.lastSyncAt}
        lastSyncError={journal.settings.lastSyncError}
        syncState={syncState}
        onSync={sync}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="content">
        {current.kind === 'flips' && <FlipsScreen flips={book.flips} list={list} />}
        {current.kind === 'holding' && <HoldingScreen buys={book.holdings} list={list} />}
        {current.kind === 'review' && <ReviewScreen unmatched={book.unmatched} list={list} />}
        {folder && (
          <FolderScreen
            key={folder.id}
            folder={folder}
            section={journal.shelved.folders.get(folder.id)!}
            list={list}
            onDeleted={() => { navigate({ kind: 'flips' }); void refresh(); }}
          />
        )}
        {current.kind === 'settings' && <SettingsPanel feeRate={journal.settings.feeRate} onSync={sync} onChange={refresh} />}
      </main>
      <SheetTabs place={current} onNavigate={navigate} folders={journal.folders} counts={countPlaces(journal)} onChange={refresh} />
    </div>
  );
}

function FlipsScreen({ flips, list }: { flips: Section['flips']; list: ListContext }) {
  const shown = sortFlips(filterFlips(flips, list.filter, new Date()), list.flipSort);
  return (
    <>
      <FlipSummary summary={summarizeSettled(shown)} filtered={!isUnfiltered(list.filter)} />
      <ListControls list={list} shown={shown.length} total={flips.length} noun="flip" periodLabel="Sold in" showFlipFilters />
      {shown.length > 0 ? (
        <FlipSheet flips={shown} sort={list.flipSort} onSort={list.setFlipSort} selection={list.selection} newSince={list.newSince} onChange={list.onChange} />
      ) : (
        <EmptyState text={flips.length ? 'No flips match these filters.' : 'No flips yet. Open CSFloat and Flipbook syncs your trades on its own.'} />
      )}
    </>
  );
}

function HoldingScreen({ buys, list }: { buys: Section['holdings']; list: ListContext }) {
  const shown = sortHoldings(filterHoldings(buys, list.filter, new Date()), list.holdingSort);
  const totalCost = centsToDollars(shown.reduce((sum, buy) => sum + buy.priceCents, 0));
  return (
    <>
      <HoldingSummary count={shown.length} totalCost={totalCost} />
      <ListControls list={list} shown={shown.length} total={buys.length} noun="item" periodLabel="Bought in" showFlipFilters={false} />
      {shown.length > 0 ? (
        <HoldingSheet buys={shown} sort={list.holdingSort} onSort={list.setHoldingSort} selection={list.selection} newSince={list.newSince} />
      ) : (
        <EmptyState text={buys.length ? 'Nothing you hold matches these filters.' : 'Nothing in hand. Every buy has been sold.'} />
      )}
    </>
  );
}

function ReviewScreen({ unmatched, list }: { unmatched: Section['unmatched']; list: ListContext }) {
  return (
    <>
      <h1 className="page-title">{reviewTitle(unmatched.length)}</h1>
      {list.selection.count > 0 && <SelectionActions selection={list.selection} folders={list.folders} onChange={list.onChange} />}
      <ReviewPanel unmatched={unmatched} selection={list.selection} onChange={list.onChange} />
    </>
  );
}

interface FolderScreenProps {
  folder: Folder;
  section: Section;
  list: ListContext;
  onDeleted: () => void;
}

function FolderScreen({ folder, section, list, onDeleted }: FolderScreenProps) {
  const now = new Date();
  const flips = sortFlips(filterFlips(section.flips, list.filter, now), list.flipSort);
  const holdings = sortHoldings(filterHoldings(section.holdings, list.filter, now), list.holdingSort);
  const total = sizeOf(section);
  const shown = flips.length + holdings.length + section.unmatched.length;

  return (
    <>
      <FolderHeader folder={folder} itemCount={total} onChange={list.onChange} onDeleted={onDeleted} />
      {flips.length > 0 && <FlipSummary summary={summarizeSettled(flips)} filtered={!isUnfiltered(list.filter)} />}
      <ListControls list={list} shown={shown} total={total} noun="item" periodLabel="When" showFlipFilters folderId={folder.id} />
      {total === 0 && <EmptyState text="This folder is empty. Select rows on another sheet and move them here." />}
      {total > 0 && shown === 0 && <EmptyState text="Nothing in this folder matches these filters." />}
      <FolderSection title="Flips" visible={flips.length > 0}>
        <FlipSheet flips={flips} sort={list.flipSort} onSort={list.setFlipSort} selection={list.selection} newSince={list.newSince} onChange={list.onChange} />
      </FolderSection>
      <FolderSection title="Holding" visible={holdings.length > 0}>
        <HoldingSheet buys={holdings} sort={list.holdingSort} onSort={list.setHoldingSort} selection={list.selection} newSince={list.newSince} />
      </FolderSection>
      {section.unmatched.length > 0 && <ReviewPanel unmatched={section.unmatched} selection={list.selection} onChange={list.onChange} />}
    </>
  );
}

function FolderSection({ title, visible, children }: { title: string; visible: boolean; children: ReactNode }) {
  if (!visible) return null;
  return (
    <section className="folder-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

interface ListControlsProps {
  list: ListContext;
  shown: number;
  total: number;
  noun: string;
  periodLabel: string;
  /** Holdings haven't been sold, so result and match filters don't apply to them. */
  showFlipFilters: boolean;
  folderId?: string;
}

function ListControls({ list, shown, total, noun, periodLabel, showFlipFilters, folderId }: ListControlsProps) {
  return (
    <>
      <Toolbar
        query={list.filter.query}
        onQuery={(query) => list.setFilter({ ...list.filter, query })}
        activeFilters={countActiveFilters(list.filter)}
        filtersOpen={list.filtersOpen}
        onToggleFilters={list.toggleFilters}
        shown={shown}
        total={total}
        noun={noun}
        selection={list.selection}
        folders={list.folders}
        currentFolderId={folderId}
        onChange={list.onChange}
      />
      {list.filtersOpen && (
        <FilterDrawer filter={list.filter} onChange={list.setFilter} showFlipFilters={showFlipFilters} periodLabel={periodLabel} />
      )}
    </>
  );
}

/** Escape drops the selection, unless the user is typing in a field. */
function useEscapeToClear(selection: Selection) {
  const { clear } = selection;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (event.target as HTMLElement).closest('input, textarea')) return;
      clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clear]);
}

function sizeOf(section: Section): number {
  return section.flips.length + section.holdings.length + section.unmatched.length;
}

function countPlaces({ shelved }: Journal): PlaceCounts {
  return {
    flips: shelved.book.flips.length,
    holding: shelved.book.holdings.length,
    review: shelved.book.unmatched.length,
    folders: new Map([...shelved.folders].map(([id, section]) => [id, sizeOf(section)])),
  };
}

function reviewTitle(count: number): string {
  if (count === 0) return 'Every sale is paired with its buy.';
  return count === 1 ? '1 sale needs a look.' : `${count} sales need a look.`;
}
