import { useState, type DragEvent, type FormEvent, type MouseEvent } from 'react';
import { deleteFolder, renameFolder } from '../../app/actions';
import { HOLDS_ID, isDefaultFolder, OTHER_ID, type Folder } from '../../domain/folders';
import { ITEM_KINDS, itemKind, KIND_PLURAL, type ItemKind } from '../../domain/itemKinds';
import { EMPTY_FILTER, isUnfiltered, type ListFilter, type ResultFilter, type SheetRow, type Sort } from '../../domain/listFilters';
import { formatMoney, formatPercent, formatSignedMoney, formatTimeAgo, plural } from '../format';
import type { Selection } from '../useSelection';
import { SheetTable, type RowDetail } from './SheetTable';
import { Kpi } from './shared';
import { TitleBar, type SyncProps } from './TitleBar';

export const PAGE_SIZES = [25, 50, 100, 'all'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
/** Below this many rows there's nothing to page through, so the pager stays hidden. */
const SMALLEST_PAGE = PAGE_SIZES[0];

const RESULTS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'listed', label: 'Listed' },
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
];

export interface SheetView {
  filter: ListFilter;
  setFilter: (filter: ListFilter) => void;
  filtersOpen: boolean;
  toggleFilters: () => void;
  sort: Sort;
  setSort: (sort: Sort) => void;
  detail: RowDetail;
  setDetail: (detail: RowDetail) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: PageSize;
  setPageSize: (size: PageSize) => void;
}

interface Props {
  /** Undefined for the Flips sheet. */
  folder?: Folder;
  /** Everything on this sheet, before filters. */
  rows: SheetRow[];
  /** Filtered and sorted. */
  shown: SheetRow[];
  view: SheetView;
  selection: Selection;
  newSince?: string;
  sync: SyncProps;
  onMoveMenu: (x: number, y: number) => void;
  onSendToOther: () => void;
  onRowMenu: (event: MouseEvent, row: SheetRow) => void;
  onRowDrag: (event: DragEvent, row: SheetRow) => void;
  onPickBuy: () => void;
  onFolderDeleted: () => void;
  onChange: () => void;
}

export function SheetScreen({ folder, rows, shown, view, selection, newSince, sync, onMoveMenu, onSendToOther, onRowMenu, onRowDrag, onPickBuy, onFolderDeleted, onChange }: Props) {
  const pageCount = view.pageSize === 'all' ? 1 : Math.max(1, Math.ceil(shown.length / view.pageSize));
  const page = Math.min(view.page, pageCount - 1);
  const pageRows = view.pageSize === 'all' ? shown : shown.slice(page * view.pageSize, (page + 1) * view.pageSize);
  const filtered = !isUnfiltered(view.filter);

  return (
    <>
      <header className="top">
        <FolderTitle folder={folder} rowCount={rows.length} sync={sync} onChange={onChange} onDeleted={onFolderDeleted} />
        <SheetNote folder={folder} />
        <div className="kpis"><SheetKpis folder={folder} rows={rows} sync={sync} /></div>
      </header>
      {selection.count > 0 ? (
        <SelectionBar count={selection.count} inOther={folder?.id === OTHER_ID} onMoveMenu={onMoveMenu} onSendToOther={onSendToOther} onClear={selection.clear} />
      ) : (
        <Toolbar view={view} shown={shown.length} total={rows.length} />
      )}
      {view.filtersOpen && <Filters rows={rows} filter={view.filter} onChange={view.setFilter} />}
      <div className="tablewrap">
        <SheetTable
          rows={pageRows}
          allRows={shown}
          detail={view.detail}
          sort={view.sort}
          onSort={view.setSort}
          selection={selection}
          newSince={newSince}
          empty={
            filtered ? (
              <>No rows match. <button className="btn ghost" onClick={() => view.setFilter(EMPTY_FILTER)}>Clear search and filters</button></>
            ) : (
              emptyText(folder)
            )
          }
          onRowMenu={onRowMenu}
          onRowDrag={onRowDrag}
          onPickBuy={onPickBuy}
        />
      </div>
      {shown.length > SMALLEST_PAGE && <Pager view={view} page={page} pageCount={pageCount} total={shown.length} />}
    </>
  );
}

function emptyText(folder?: Folder): string {
  if (!folder) return 'No trades yet. Open CSFloat and Flipbook syncs your trades on its own.';
  if (folder.id === HOLDS_ID) return 'Nothing here yet. Move items you bought to keep here and they stop counting as flips.';
  if (folder.id === OTHER_ID) return 'Nothing here. Sales with no buy on record land here on their own.';
  return 'This folder is empty. Drag rows onto it in the sidebar, or select rows and use Move to.';
}

function SheetNote({ folder }: { folder?: Folder }) {
  if (!folder) return null;
  if (folder.id === OTHER_ID) {
    return <p className="note">Sales with no buy on record land here on their own. If one of them was a real flip, move it back to Flips.</p>;
  }
  if (folder.id === HOLDS_ID) {
    return <p className="note">Items you bought to keep or use. They don't count toward your flip totals. Move one back to Flips when you decide to sell it.</p>;
  }
  return <p className="note">Nothing in this folder counts toward your flip totals or the export.</p>;
}

function SheetKpis({ folder, rows, sync }: { folder?: Folder; rows: SheetRow[]; sync: SyncProps }) {
  const closed = rows.filter((row) => row.status === 'closed');
  const open = rows.filter((row) => row.status === 'open');
  const sales = rows.filter((row) => row.status === 'sale');
  const sum = (list: SheetRow[], pick: (row: SheetRow) => number | undefined) => list.reduce((total, row) => total + (pick(row) ?? 0), 0);

  if (folder?.id === OTHER_ID) {
    return (
      <>
        <Kpi label="Sold" value={sales.length} />
        <Kpi label="Sale value" value={formatMoney(sum(sales, (row) => row.sellPrice))} />
      </>
    );
  }
  if (folder?.id === HOLDS_ID) {
    return (
      <>
        <Kpi label="Holding" value={open.length} />
        <Kpi label="Cost" value={formatMoney(sum(open, (row) => row.buyPrice))} />
        <HoldValue open={open} sync={sync} />
        <Kpi label="Longest held" value={plural(Math.max(0, ...open.map((row) => row.held ?? 0)), 'day')} />
      </>
    );
  }

  const net = sum(closed, (row) => row.net);
  const wins = closed.filter((row) => (row.net ?? 0) >= 0).length;
  const averagePercent = closed.length ? sum(closed, (row) => row.percent) / closed.length : 0;
  return (
    <>
      <Kpi label="Net profit" value={formatSignedMoney(net)} sign={closed.length ? net : undefined} />
      <Kpi label="Closed" value={closed.length} />
      <Kpi label="Win rate" value={closed.length ? `${Math.round((wins / closed.length) * 100)}%` : '0%'} />
      <Kpi label="Avg profit" value={formatPercent(averagePercent)} sign={closed.length ? averagePercent : undefined} />
      <Kpi label="Open" value={open.length} sub={`${formatMoney(sum(open, (row) => row.buyPrice))} in`} />
    </>
  );
}

/** What held items sell for on CSFloat now, and what selling all of them would make. */
function HoldValue({ open, sync }: { open: SheetRow[]; sync: SyncProps }) {
  const priced = open.filter((row) => row.quote);
  const oldest = priced.map((row) => row.quote!.fetchedAt).sort()[0];
  const paused = sync.pricesPausedUntil !== undefined && Date.parse(sync.pricesPausedUntil) > Date.now();
  const refreshing = sync.syncState.kind === 'syncing';
  const status = paused
    ? 'CSFloat asked for a break; prices resume soon'
    : priced.length === 0
      ? 'Not priced yet'
      : `${priced.length} of ${open.length} priced, ${formatTimeAgo(oldest!)}`;
  const net = priced.reduce((total, row) => total + row.quote!.net, 0);

  return (
    <>
      <Kpi label="Worth now" value={priced.length ? formatMoney(priced.reduce((total, row) => total + row.quote!.price, 0)) : ''} sub={status} />
      <Kpi label="If sold now" value={priced.length ? formatSignedMoney(net) : ''} sign={priced.length ? net : undefined} sub={priced.length ? 'after the fee' : undefined} />
      <div className="kpi-action">
        <button className="btn ghost" onClick={sync.onRefreshPrices} disabled={refreshing || paused}>
          {refreshing ? 'Pricing…' : 'Refresh prices'}
        </button>
      </div>
    </>
  );
}

interface FolderTitleProps {
  folder?: Folder;
  rowCount: number;
  sync: SyncProps;
  onChange: () => void;
  onDeleted: () => void;
}

/** The page title. A folder the user made can be renamed or deleted from here. */
function FolderTitle({ folder, rowCount, sync, onChange, onDeleted }: FolderTitleProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const editable = folder !== undefined && !isDefaultFolder(folder.id);

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (folder && name.trim()) await renameFolder(folder, name);
    setEditing(false);
    onChange();
  };

  const remove = async () => {
    if (!folder) return;
    const rows = rowCount === 1 ? 'Its 1 row goes' : `Its ${rowCount} rows go`;
    if (!window.confirm(`Delete ${folder.name}? ${rows} back to Flips, Holds or Other.`)) return;
    await deleteFolder(folder.id);
    onDeleted();
  };

  if (editing) {
    return (
      <form className="titlebar" onSubmit={rename}>
        <input
          className="search title-input"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
          aria-label="Folder name"
          maxLength={32}
        />
        <button className="btn" type="submit">Save</button>
        <button className="btn ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
      </form>
    );
  }

  return (
    <TitleBar title={folder?.name ?? 'Flips'} {...sync}>
      {editable && (
        <>
          <button className="btn ghost" onClick={() => { setName(folder.name); setEditing(true); }}>Rename</button>
          <button className="btn ghost" onClick={remove}>Delete</button>
        </>
      )}
    </TitleBar>
  );
}

function Toolbar({ view, shown, total }: { view: SheetView; shown: number; total: number }) {
  const activeFilters = view.filter.kinds.length + (view.filter.result === 'all' ? 0 : 1);
  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        value={view.filter.query}
        onChange={(event) => view.setFilter({ ...view.filter, query: event.target.value })}
        placeholder="Search items"
        aria-label="Search items"
        autoComplete="off"
      />
      <button className="btn" aria-expanded={view.filtersOpen} aria-controls="filters" onClick={view.toggleFilters}>
        Filters{activeFilters > 0 && <span className="badge">{activeFilters}</span>}
      </button>
      <span className="count" aria-live="polite">{shown === total ? plural(total, 'row') : `${shown} of ${plural(total, 'row')}`}</span>
      <div className="tb-end">
        <div className="seg" role="group" aria-label="Row detail">
          <button aria-pressed={view.detail === 'compact'} onClick={() => view.setDetail('compact')}>Compact</button>
          <button aria-pressed={view.detail === 'detailed'} onClick={() => view.setDetail('detailed')}>Detailed</button>
        </div>
      </div>
    </div>
  );
}

interface SelectionBarProps {
  count: number;
  inOther: boolean;
  onMoveMenu: (x: number, y: number) => void;
  onSendToOther: () => void;
  onClear: () => void;
}

function SelectionBar({ count, inOther, onMoveMenu, onSendToOther, onClear }: SelectionBarProps) {
  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onMoveMenu(box.left, box.bottom + 4);
  };
  return (
    <div className="toolbar selbar" role="region" aria-label="Selected rows">
      <strong>{count} selected</strong>
      <button className="btn pri" aria-haspopup="menu" onClick={openMenu}>Move to ▾</button>
      {!inOther && <button className="btn" onClick={onSendToOther}>Not a flip</button>}
      <span className="hint">You can also drag rows onto a folder, or right-click.</span>
      <div className="tb-end"><button className="btn ghost" onClick={onClear}>Clear</button></div>
    </div>
  );
}

/** Only the kinds on this sheet get a chip. */
function Filters({ rows, filter, onChange }: { rows: SheetRow[]; filter: ListFilter; onChange: (filter: ListFilter) => void }) {
  const present = new Set(rows.map((row) => itemKind(row.item)));
  const kinds = ITEM_KINDS.filter((kind) => present.has(kind) || filter.kinds.includes(kind));
  const toggle = (kind: ItemKind) =>
    onChange({ ...filter, kinds: filter.kinds.includes(kind) ? filter.kinds.filter((k) => k !== kind) : [...filter.kinds, kind] });
  const narrowed = filter.kinds.length > 0 || filter.result !== 'all';

  return (
    <div className="filters" id="filters">
      <span className="flabel">Type</span>
      {kinds.map((kind) => (
        <button key={kind} className="chip" aria-pressed={filter.kinds.includes(kind)} onClick={() => toggle(kind)}>{KIND_PLURAL[kind]}</button>
      ))}
      <span className="flabel">Result</span>
      {RESULTS.map((result) => (
        <button key={result.value} className="chip" aria-pressed={filter.result === result.value} onClick={() => onChange({ ...filter, result: result.value })}>
          {result.label}
        </button>
      ))}
      {narrowed && <button className="btn ghost" onClick={() => onChange({ ...filter, kinds: [], result: 'all' })}>Clear filters</button>}
    </div>
  );
}

function Pager({ view, page, pageCount, total }: { view: SheetView; page: number; pageCount: number; total: number }) {
  const size = view.pageSize === 'all' ? total : view.pageSize;
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <div className="pager" role="navigation" aria-label="Pages">
      <span className="count">{from} to {to} of {total}</span>
      <div className="tb-end">
        <span className="hint">Rows per page</span>
        <div className="seg" role="group" aria-label="Rows per page">
          {PAGE_SIZES.map((option) => (
            <button key={option} aria-pressed={view.pageSize === option} onClick={() => view.setPageSize(option)}>
              {option === 'all' ? 'All' : option}
            </button>
          ))}
        </div>
        <button className="btn sq" aria-label="Previous page" disabled={page === 0} onClick={() => view.setPage(page - 1)}>‹</button>
        <span className="count">Page {page + 1} of {pageCount}</span>
        <button className="btn sq" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => view.setPage(page + 1)}>›</button>
      </div>
    </div>
  );
}
