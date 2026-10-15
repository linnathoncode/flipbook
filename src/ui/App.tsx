import { useState, type ReactNode } from 'react';
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
import type { Journal } from '../app/actions';
import { DataPanel } from './components/DataPanel';
import { FilterPanel } from './components/FilterPanel';
import { FlipList } from './components/FlipList';
import { FolderHeader } from './components/FolderHeader';
import { FlipHeadline, HoldingHeadline, PlainHeadline } from './components/Headline';
import { HoldingList } from './components/HoldingList';
import { Masthead } from './components/Masthead';
import { ReviewPanel } from './components/ReviewPanel';
import { SelectionBar } from './components/SelectionBar';
import { EmptyState } from './components/shared';
import { Sidebar, type PlaceCounts } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import type { Place, ViewMode } from './places';
import { useJournal } from './useJournal';
import { usePreference } from './usePreference';
import { useSelection, type Selection } from './useSelection';

const DEFAULT_FLIP_SORT: Sort<FlipSortKey> = { key: 'sold', descending: true };
const DEFAULT_HOLDING_SORT: Sort<HoldingSortKey> = { key: 'bought', descending: true };
const PERIOD_LABEL: Partial<Record<Place['kind'], string>> = { flips: 'Sold', holding: 'Bought' };

/** How the user wants lists shown; shared by every list screen. */
interface ListSettings {
  filter: ListFilter;
  setFilter: (filter: ListFilter) => void;
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  flipSort: Sort<FlipSortKey>;
  setFlipSort: (sort: Sort<FlipSortKey>) => void;
  holdingSort: Sort<HoldingSortKey>;
  setHoldingSort: (sort: Sort<HoldingSortKey>) => void;
  selection: Selection;
}

export function App() {
  const { journal, error, refresh, sync, syncState } = useJournal();
  const [place, setPlace] = useState<Place>({ kind: 'flips' });
  const [filter, setFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [mode, setMode] = usePreference<ViewMode>('view-mode', 'ledger');
  const [flipSort, setFlipSort] = usePreference('flip-sort', DEFAULT_FLIP_SORT);
  const [holdingSort, setHoldingSort] = usePreference('holding-sort', DEFAULT_HOLDING_SORT);
  const selection = useSelection();

  if (error) return <main className="page"><p className="notice notice-error">{error}</p></main>;
  if (!journal) return <main className="page" aria-busy="true" />;

  const navigate = (next: Place) => {
    selection.clear();
    setPlace(next);
  };

  // A folder deleted elsewhere (or just now) falls back to the book.
  const folder = place.kind === 'folder' ? journal.folders.find((candidate) => candidate.id === place.folderId) : undefined;
  const current: Place = place.kind === 'folder' && !folder ? { kind: 'flips' } : place;
  const settings: ListSettings = { filter, setFilter, mode, setMode, flipSort, setFlipSort, holdingSort, setHoldingSort, selection };
  const showFilters = current.kind === 'flips' || current.kind === 'holding' || current.kind === 'folder';
  const { book } = journal.shelved;

  return (
    <div className={`page ${selection.count > 0 ? 'has-selection' : ''}`}>
      <Masthead
        lastSyncAt={journal.settings.lastSyncAt}
        lastSyncError={journal.settings.lastSyncError}
        syncState={syncState}
        onSync={sync}
      />
      <div className="layout">
        <Sidebar place={current} onNavigate={navigate} folders={journal.folders} counts={countPlaces(journal)} onChange={refresh}>
          {showFilters && (
            <FilterPanel
              filter={filter}
              onChange={setFilter}
              showFlipFilters={current.kind !== 'holding'}
              periodLabel={PERIOD_LABEL[current.kind] ?? 'When'}
            />
          )}
        </Sidebar>
        <main className="content">
          {current.kind === 'flips' && <FlipsScreen flips={book.flips} settings={settings} onChange={refresh} />}
          {current.kind === 'holding' && <HoldingScreen buys={book.holdings} settings={settings} />}
          {current.kind === 'review' && (
            <>
              <PlainHeadline text={reviewHeadline(book.unmatched.length)} />
              <ReviewPanel unmatched={book.unmatched} selection={selection} onChange={refresh} />
            </>
          )}
          {folder && (
            <FolderScreen
              key={folder.id}
              folder={folder}
              section={journal.shelved.folders.get(folder.id)!}
              settings={settings}
              onChange={refresh}
              onDeleted={() => { navigate({ kind: 'flips' }); void refresh(); }}
            />
          )}
          {current.kind === 'data' && <DataPanel feeRate={journal.settings.feeRate} onSync={sync} onChange={refresh} />}
        </main>
      </div>
      <SelectionBar selection={selection} folders={journal.folders} currentFolderId={folder?.id} onChange={refresh} />
    </div>
  );
}

function FlipsScreen({ flips, settings, onChange }: { flips: Section['flips']; settings: ListSettings; onChange: () => void }) {
  const shown = sortFlips(filterFlips(flips, settings.filter, new Date()), settings.flipSort);
  return (
    <>
      <FlipHeadline summary={summarizeSettled(shown)} filtered={!isUnfiltered(settings.filter)} />
      <ListToolbar settings={settings} shown={shown.length} total={flips.length} noun="flip" />
      {shown.length > 0 ? (
        <FlipList flips={shown} mode={settings.mode} sort={settings.flipSort} onSort={settings.setFlipSort} selection={settings.selection} onChange={onChange} />
      ) : (
        <EmptyState text={flips.length ? 'No flips match these filters.' : 'No flips yet. Open CSFloat and Flipbook syncs your trades on its own.'} />
      )}
    </>
  );
}

function HoldingScreen({ buys, settings }: { buys: Section['holdings']; settings: ListSettings }) {
  const shown = sortHoldings(filterHoldings(buys, settings.filter, new Date()), settings.holdingSort);
  const totalCost = centsToDollars(shown.reduce((sum, buy) => sum + buy.priceCents, 0));
  return (
    <>
      <HoldingHeadline count={shown.length} totalCost={totalCost} />
      <ListToolbar settings={settings} shown={shown.length} total={buys.length} noun="item" />
      {shown.length > 0 ? (
        <HoldingList buys={shown} mode={settings.mode} sort={settings.holdingSort} onSort={settings.setHoldingSort} selection={settings.selection} />
      ) : (
        <EmptyState text={buys.length ? 'Nothing you hold matches these filters.' : 'Nothing in hand. Every buy has been sold.'} />
      )}
    </>
  );
}

interface FolderScreenProps {
  folder: Folder;
  section: Section;
  settings: ListSettings;
  onChange: () => void;
  onDeleted: () => void;
}

function FolderScreen({ folder, section, settings, onChange, onDeleted }: FolderScreenProps) {
  const now = new Date();
  const flips = sortFlips(filterFlips(section.flips, settings.filter, now), settings.flipSort);
  const holdings = sortHoldings(filterHoldings(section.holdings, settings.filter, now), settings.holdingSort);
  const total = sizeOf(section);
  const shown = flips.length + holdings.length + section.unmatched.length;

  return (
    <>
      <FolderHeader folder={folder} itemCount={total} onChange={onChange} onDeleted={onDeleted} />
      {flips.length > 0 && <FlipHeadline summary={summarizeSettled(flips)} filtered={!isUnfiltered(settings.filter)} />}
      <ListToolbar settings={settings} shown={shown} total={total} noun="item" />
      {total === 0 && <EmptyState text="This folder is empty. Select rows in Flips or Holding and move them here." />}
      {total > 0 && shown === 0 && <EmptyState text="Nothing in this folder matches these filters." />}
      <FolderSection title="Flips" visible={flips.length > 0}>
        <FlipList flips={flips} mode={settings.mode} sort={settings.flipSort} onSort={settings.setFlipSort} selection={settings.selection} onChange={onChange} />
      </FolderSection>
      <FolderSection title="Holding" visible={holdings.length > 0}>
        <HoldingList buys={holdings} mode={settings.mode} sort={settings.holdingSort} onSort={settings.setHoldingSort} selection={settings.selection} />
      </FolderSection>
      {section.unmatched.length > 0 && <ReviewPanel unmatched={section.unmatched} selection={settings.selection} onChange={onChange} />}
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

function ListToolbar({ settings, shown, total, noun }: { settings: ListSettings; shown: number; total: number; noun: string }) {
  return (
    <Toolbar
      query={settings.filter.query}
      onQuery={(query) => settings.setFilter({ ...settings.filter, query })}
      shown={shown}
      total={total}
      noun={noun}
      mode={settings.mode}
      onMode={settings.setMode}
    />
  );
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

function reviewHeadline(count: number): string {
  if (count === 0) return 'Every sale is paired with its buy.';
  return count === 1 ? '1 sale needs a look.' : `${count} sales need a look.`;
}
