import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { addRule, moveTrades, releaseManualMatch, type Journal } from '../app/actions';
import { OTHER_ID, sectionSize, type Folder, type Section } from '../domain/folders';
import { itemKind, KIND_PLURAL } from '../domain/itemKinds';
import { EMPTY_FILTER, filterRows, sectionRows, SORT_KEYS, sortRows, type ListFilter, type SheetRow, type Sort } from '../domain/listFilters';
import { AnalyticsScreen } from './components/AnalyticsScreen';
import { MoveMenu, type MenuTarget } from './components/MoveMenu';
import { ReviewScreen } from './components/ReviewScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { PAGE_SIZES, SheetScreen, type PageSize, type SheetView } from './components/SheetScreen';
import { rowEntry, type RowDetail } from './components/SheetTable';
import { Sidebar, type PlaceCounts } from './components/Sidebar';
import type { SyncProps } from './components/TitleBar';
import { plural } from './format';
import { isSheet, type Place } from './places';
import { useJournal } from './useJournal';
import { useLastVisit } from './useLastVisit';
import { usePreference } from './usePreference';
import { useSelection, type Selection } from './useSelection';
import { useTheme } from './useTheme';
import { Toast, useToast } from './useToast';

// Newest buys on top, the way the tracker sheet reads.
const DEFAULT_SORT: Sort = { key: 'bought', descending: true };
const FLIPS: MenuTarget = { id: null, name: 'Flips' };

export function App() {
  const { journal, error, refresh, sync, refreshPrices, syncState } = useJournal();
  const [theme, toggleTheme] = useTheme();
  const lastVisit = useLastVisit();
  const [place, setPlace] = useState<Place>({ kind: 'flips' });
  const [filter, setFilterState] = useState<ListFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [storedSort, setStoredSort] = usePreference<Sort>('sheet-sort', DEFAULT_SORT);
  const [detail, setDetail] = usePreference<RowDetail>('row-detail', 'compact');
  const [storedPageSize, setStoredPageSize] = usePreference<PageSize>('page-size', 25);
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const selection = useSelection();
  const { toast, show, dismiss } = useToast();

  // Preferences saved by an older version may name columns that no longer exist.
  const sort = SORT_KEYS.includes(storedSort.key) ? storedSort : DEFAULT_SORT;
  const pageSize = PAGE_SIZES.includes(storedPageSize) ? storedPageSize : 25;

  // A folder deleted elsewhere (or just now) falls back to Flips.
  const folder = place.kind === 'folder' ? journal?.folders.find((candidate) => candidate.id === place.folderId) : undefined;
  const current: Place = place.kind === 'folder' && journal && !folder ? { kind: 'flips' } : place;
  const section = journal && sectionAt(journal, current);
  const rows = section && journal ? sectionRows(section, journal.settings.feeRate, new Date(), { listed: journal.listed, prices: journal.prices }) : [];
  const shown = sortRows(filterRows(rows, filter), sort);

  useKeyboard({
    onEscape: () => (menu ? setMenu(undefined) : selection.clear()),
    onSelectAll: isSheet(current) ? () => selection.setAll(shown.map(rowEntry), true) : undefined,
  });

  if (error) return <main className="boot"><p className="sync err">{error}</p></main>;
  if (!journal) return <main className="boot" aria-busy="true" />;

  const navigate = (next: Place) => {
    selection.clear();
    setMenu(undefined);
    setPage(0);
    setFilterState(EMPTY_FILTER);
    setFiltersOpen(false);
    setPlace(next);
  };

  const view: SheetView = {
    filter,
    setFilter: (next) => {
      setFilterState(next);
      setPage(0);
      selection.clear();
    },
    filtersOpen,
    toggleFilters: () => setFiltersOpen(!filtersOpen),
    sort,
    setSort: (next) => {
      setStoredSort(next);
      setPage(0);
    },
    detail,
    setDetail,
    page,
    setPage,
    pageSize,
    setPageSize: (next) => {
      setStoredPageSize(next);
      setPage(0);
    },
  };

  const syncProps: SyncProps = {
    lastSyncAt: journal.settings.lastSyncAt,
    lastSyncError: journal.settings.lastSyncError,
    syncState,
    onSync: sync,
    onRefreshPrices: refreshPrices,
    pricesPausedUntil: journal.settings.pricesPausedUntil,
    theme,
    onToggleTheme: toggleTheme,
  };

  const selectedRows = () => {
    const keys = new Set(selection.keys());
    return rows.filter((row) => keys.has(row.key));
  };

  const move = async (target: MenuTarget) => {
    const moving = selectedRows();
    setMenu(undefined);
    if (moving.length === 0) return;
    await moveTrades(moving.flatMap((row) => row.tradeIds), target.id);
    selection.clear();
    await refresh();
    show({ text: `Moved ${plural(moving.length, 'item')} to ${target.name}.`, action: ruleOffer(moving, target, journal) });
  };

  const ruleOffer = (moved: SheetRow[], target: MenuTarget, { settings }: Journal) => {
    const kinds = new Set(moved.map((row) => itemKind(row.item)));
    const [kind] = kinds;
    const folderId = target.id;
    if (!folderId || folderId === OTHER_ID || kinds.size !== 1 || kind === 'other') return undefined;
    if (settings.rules.some((rule) => rule.kind === kind && rule.folderId === folderId)) return undefined;
    const kindName = KIND_PLURAL[kind].toLowerCase();
    return {
      label: `Always put ${kindName} in ${target.name}`,
      run: async () => {
        await addRule(kind, folderId);
        await refresh();
        show({ text: `Rule saved. New ${kindName} you buy will go to ${target.name}.` });
      },
    };
  };

  const moveTo = (folderId: string | null) => {
    const target = folderId === null ? FLIPS : journal.folders.find((candidate) => candidate.id === folderId);
    if (target) void move({ id: target.id, name: target.name });
  };

  const unpair = async () => {
    const paired = selectedRows().filter((row) => row.match === 'manual' || row.match === 'tracker');
    setMenu(undefined);
    await Promise.all(paired.map((row) => releaseManualMatch(row.sell!.id)));
    selection.clear();
    await refresh();
    show({ text: `Unpaired ${plural(paired.length, 'sale')}. Flipbook will match ${paired.length === 1 ? 'it' : 'them'} again.` });
  };

  const onRowMenu = (event: MouseEvent, row: SheetRow) => {
    event.preventDefault();
    selectRow(selection, row);
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const onRowDrag = (event: DragEvent, row: SheetRow) => {
    const count = selectRow(selection, row);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', plural(count, 'row'));
  };

  const currentFolderId = current.kind === 'folder' ? current.folderId : undefined;
  const menuTargets: MenuTarget[] = [
    ...(current.kind === 'flips' ? [] : [FLIPS]),
    ...journal.folders.filter((candidate) => candidate.id !== currentFolderId),
  ];
  const selected = menu ? selectedRows() : [];

  return (
    <div className={`fb ${selection.count > 0 ? 'has-sel' : ''}`} data-rows={detail}>
      <Sidebar
        place={current}
        onNavigate={navigate}
        folders={journal.folders}
        counts={countPlaces(journal)}
        onDropRows={moveTo}
        onFolderCreated={(created) => {
          void refresh();
          show({ text: `Made ${created.name}. Drag rows onto it to fill it.` });
        }}
      />
      <main className="main">
        {isSheet(current) && (
          <SheetScreen
            key={currentFolderId ?? 'flips'}
            folder={folder}
            rows={rows}
            shown={shown}
            view={view}
            selection={selection}
            newSince={lastVisit}
            sync={syncProps}
            onMoveMenu={(x, y) => setMenu(menu ? undefined : { x, y })}
            onSendToOther={() => moveTo(OTHER_ID)}
            onRowMenu={onRowMenu}
            onRowDrag={onRowDrag}
            onPickBuy={() => navigate({ kind: 'review' })}
            onFolderDeleted={() => {
              navigate({ kind: 'flips' });
              void refresh();
            }}
            onChange={refresh}
          />
        )}
        {current.kind === 'review' && (
          <ReviewScreen
            review={journal.review}
            sentToOther={journal.settings.orphansToOther ? (journal.shelved.folders.get(OTHER_ID)?.sales.length ?? 0) : 0}
            feeRate={journal.settings.feeRate}
            sync={syncProps}
            onPaired={(name) => {
              void refresh();
              show({ text: `Paired. ${name} is a flip now.` });
            }}
            onOpenOther={() => navigate({ kind: 'folder', folderId: OTHER_ID })}
          />
        )}
        {current.kind === 'analytics' && <AnalyticsScreen book={journal.shelved.book} feeRate={journal.settings.feeRate} sync={syncProps} />}
        {current.kind === 'settings' && (
          <SettingsPanel
            feeRate={journal.settings.feeRate}
            rules={journal.settings.rules}
            orphansToOther={journal.settings.orphansToOther}
            listingsError={journal.settings.listingsError}
            folders={journal.folders}
            sync={syncProps}
            onChange={refresh}
          />
        )}
        <Toast toast={toast} onDismiss={dismiss} />
      </main>
      {menu && (
        <MoveMenu
          x={menu.x}
          y={menu.y}
          count={selection.count}
          targets={menuTargets}
          canSendToOther={currentFolderId !== OTHER_ID}
          canUnpair={selected.some((row) => row.match === 'manual' || row.match === 'tracker')}
          onMove={moveTo}
          onFolderCreated={(created: Folder) => void move({ id: created.id, name: created.name })}
          onUnpair={() => void unpair()}
          onClear={() => {
            selection.clear();
            setMenu(undefined);
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
    </div>
  );
}

function sectionAt(journal: Journal, place: Place): Section | undefined {
  if (place.kind === 'flips') return journal.shelved.book;
  if (place.kind === 'folder') return journal.shelved.folders.get(place.folderId);
  return undefined;
}

/** Right-click or drag on a row outside the selection acts on that row alone, like a file manager. */
function selectRow(selection: Selection, row: SheetRow): number {
  if (selection.has(row.key)) return selection.count;
  selection.click(rowEntry(row), { add: false, range: false }, []);
  return 1;
}

function countPlaces({ shelved, review }: Journal): PlaceCounts {
  return {
    flips: sectionSize(shelved.book),
    review: review.length,
    folders: new Map([...shelved.folders].map(([id, section]) => [id, sectionSize(section)])),
  };
}

interface KeyboardHandlers {
  onEscape: () => void;
  /** Ctrl/Cmd+A: every row that passes the filters, on every page. */
  onSelectAll?: () => void;
}

/** Shortcuts stay out of the way while the user types in a field. */
function useKeyboard(handlers: KeyboardHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea')) return;
      if (event.key === 'Escape') latest.current.onEscape();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && latest.current.onSelectAll) {
        event.preventDefault();
        latest.current.onSelectAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
