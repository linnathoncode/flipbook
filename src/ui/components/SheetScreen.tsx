import { useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type FormEvent, type MouseEvent, type RefObject } from 'react';
import { deleteFolder, renameFolder } from '../../app/actions';
import { HOLDS_ID, isDefaultFolder, OTHER_ID, type Folder } from '../../domain/folders';
import { ITEM_KINDS, itemKind, KIND_PLURAL } from '../../domain/itemKinds';
import { clearChips, EMPTY_FILTER, isNarrowed, isUnfiltered, pickResult, toggleExcludedKind, toggleExcludedResult, toggleKind, totalRows, type ListFilter, type ResultFilter, type SheetRow, type Sort } from '../../domain/listFilters';
import { formatMoney, formatPercent, formatSignedMoney, formatTimeAgo, plural, roundTo } from '../format';
import type { Selection } from '../useSelection';
import type { AnalyticsDrilldown } from './AnalyticsScreen';
import { Icon } from './Icon';
import { PageTurner } from './PageTurner';
import { SheetTable, TradeInspector, type FlipPricing, type RowDetail } from './SheetTable';
import { Kpi } from './shared';
import { TitleBar, type SyncProps } from './TitleBar';

export const PAGE_SIZES = [25, 50, 100, 'all'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
/** Below this many rows there's nothing to page through, so the pager stays hidden. */
const SMALLEST_PAGE = PAGE_SIZES[0];

const ROW_DETAILS = { detailed: 'Detailed', compact: 'Compact' } as const;

const RESULTS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'listed', label: 'Listed' },
  { value: 'win', label: 'Flips' },
  { value: 'loss', label: 'Flops' },
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
  adaptive: boolean;
  expandedKey?: string;
  detailsTrigger: RefObject<HTMLButtonElement>;
  onToggleDetails: (key: string) => void;
  drilldown?: AnalyticsDrilldown;
  onBackToAnalytics: () => void;
  onClearDrilldown: () => void;
  /** Undefined for the Flips sheet. */
  folder?: Folder;
  /** Everything on this sheet, before filters. */
  rows: SheetRow[];
  scopedRows: SheetRow[];
  /** Filtered and sorted. */
  shown: SheetRow[];
  hasSales: boolean;
  view: SheetView;
  selection: Selection;
  newSince?: string;
  sync: SyncProps;
  onMoveMenu: (trigger: HTMLButtonElement) => void;
  moveMenuOpen: boolean;
  flipPricing?: FlipPricing;
  onRowMenu: (event: MouseEvent, row: SheetRow) => void;
  onRowDrag: (event: DragEvent, row: SheetRow) => void;
  onPickBuy: () => void;
  onFolderDeleted: () => void;
  onChange: () => void;
}

const WIDE_INSPECTOR = '(min-width: 1760px)';

export function SheetScreen({
  adaptive, expandedKey, detailsTrigger, onToggleDetails, drilldown, onBackToAnalytics, onClearDrilldown,
  folder, rows, scopedRows, shown, hasSales, view, selection, newSince, sync, onMoveMenu, moveMenuOpen, flipPricing, onRowMenu, onRowDrag,
  onPickBuy, onFolderDeleted, onChange,
}: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const backToAnalytics = useRef<HTMLButtonElement>(null);
  const focusSearch = useRef(false);
  const focusInspector = useRef(false);
  const [excluding, setExcluding] = useState(false);
  const detailsId = useId();
  const scopeLabelId = useId();
  useLayoutEffect(() => {
    if (drilldown) backToAnalytics.current?.focus({ preventScroll: true });
    else if (focusSearch.current) {
      focusSearch.current = false;
      sheet.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }
  }, [drilldown]);
  const [wide, setWide] = useState(() => matchMedia(WIDE_INSPECTOR).matches);
  useEffect(() => {
    const query = matchMedia(WIDE_INSPECTOR);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useSheetDivider(sheet);
  const pageCount = view.pageSize === 'all' ? 1 : Math.max(1, Math.ceil(shown.length / view.pageSize));
  const page = Math.min(view.page, pageCount - 1);
  const pageRows = view.pageSize === 'all' ? shown : shown.slice(page * view.pageSize, (page + 1) * view.pageSize);
  const filtered = !isUnfiltered(view.filter);
  const holds = folder?.id === HOLDS_ID;
  const showInspector = adaptive && wide;
  const expandedRow = pageRows.find((row) => row.key === expandedKey);
  useLayoutEffect(() => {
    if (focusInspector.current) {
      focusInspector.current = false;
      inspectorHeading.current?.focus();
    }
  }, [expandedRow?.key]);

  const toggleDetails = (key: string, fromButton?: boolean) => {
    if (showInspector && fromButton && expandedRow?.key !== key) focusInspector.current = true;
    onToggleDetails(key);
  };
  const showFilters = () => {
    if (!showInspector) {
      view.toggleFilters();
      return;
    }
    if (expandedRow) {
      focusInspector.current = true;
      onToggleDetails(expandedRow.key);
    } else inspectorHeading.current?.focus();
  };
  const filterControls = <Filters rows={scopedRows} filter={view.filter} onChange={view.setFilter}
    excluding={excluding} setExcluding={setExcluding} />;

  return (
    <div className="sheet-workspace" ref={sheet} data-inspector={showInspector || undefined}>
      <header className="top">
        <FolderTitle folder={folder} rowCount={rows.length} sync={sync} onChange={onChange} onDeleted={onFolderDeleted} />
        <SheetNote folder={folder} />
        {drilldown ? (
          <section className="analytics-scope" aria-labelledby={scopeLabelId}>
            <div id={scopeLabelId}><strong>{drilldown.label}</strong><span className="hint">{plural(scopedRows.length, 'trade')} · {drilldown.period}</span></div>
            <button className="btn" ref={backToAnalytics} aria-describedby={scopeLabelId} onClick={onBackToAnalytics}>‹ Analytics</button>
            <button className="btn ghost" onClick={() => {
              focusSearch.current = true;
              onClearDrilldown();
            }}>Clear Analytics filter</button>
          </section>
        ) : (
          <div className={folder?.id === HOLDS_ID ? 'kpis holds-kpis' : 'kpis'}>
            <SheetKpis folder={folder} rows={rows} sync={sync} />
          </div>
        )}
      </header>
      {selection.count > 0 ? (
        <SelectionBar count={selection.count} onMoveMenu={onMoveMenu} moveMenuOpen={moveMenuOpen} onClear={selection.clear} />
      ) : (
        <Toolbar view={view} shown={shown.length} total={rows.length} holds={holds} hasSales={hasSales}
          inspectorId={showInspector ? detailsId : undefined} filtersVisible={view.filtersOpen} onFilters={showFilters} />
      )}
      {!showInspector && view.filtersOpen && filterControls}
      <div className="tablewrap" role="region" aria-label="Trade ledger" tabIndex={0}>
        <SheetTable
          rows={pageRows}
          allRows={shown}
          hasSales={hasSales}
          expandedKey={expandedRow?.key}
          detailsTrigger={detailsTrigger}
          detailsId={detailsId}
          inlineDetails={!showInspector}
          onToggleDetails={toggleDetails}
          detail={view.detail}
          showMarketPrices={holds}
          sort={view.sort}
          onSort={view.setSort}
          selection={selection}
          newSince={newSince}
          flipPricing={flipPricing}
          empty={
            filtered ? (
              <>No rows match. <button className="btn ghost" onClick={() => view.setFilter(EMPTY_FILTER)}>Clear search and filters</button></>
            ) : (
              drilldown ? 'No trades from this Analytics selection remain in Flips.' : emptyText(folder)
            )
          }
          onRowMenu={onRowMenu}
          onRowDrag={onRowDrag}
          onPickBuy={onPickBuy}
        />
      </div>
      {shown.length > SMALLEST_PAGE && <Pager view={view} page={page} pageCount={pageCount} total={shown.length} />}
      {showInspector && (
        <aside className="sheet-inspector" id={detailsId}
          aria-label={expandedRow ? 'Trade details' : 'Filters'}>
          <div className="sheet-inspector-header">
            <h2 ref={inspectorHeading} tabIndex={-1}>{expandedRow ? 'Trade details' : 'Filters'}</h2>
            {expandedRow && <button className="btn ghost" onClick={showFilters}>Back to filters</button>}
          </div>
          {expandedRow
            ? <TradeInspector row={expandedRow} showMarketPrices={holds} pricing={flipPricing} />
            : filterControls}
        </aside>
      )}
    </div>
  );
}

function useSheetDivider(sheet: RefObject<HTMLDivElement>) {
  useLayoutEffect(() => {
    const workspace = sheet.current;
    const divider = workspace?.closest('.fb')?.querySelector<HTMLElement>('.nav-gap');
    const table = workspace?.querySelector<HTMLElement>('.tablewrap');
    const header = table?.querySelector('thead');
    const folders = divider?.previousElementSibling;
    if (!divider || !table || !header || !folders) return;

    let extra = 0;
    const align = () => {
      if (!divider.offsetParent) return;
      const transform = getComputedStyle(table).transform;
      const translation = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
      const headerBottom = table.getBoundingClientRect().top - translation + header.getBoundingClientRect().height;
      const dividerBottom = divider.getBoundingClientRect().bottom + (divider.parentElement?.scrollTop ?? 0);
      const next = Math.max(0, extra + headerBottom - dividerBottom);
      if (Math.abs(extra - next) < 0.02) return;
      extra = next;
      divider.style.setProperty('--sheet-divider-offset', `${extra}px`);
    };

    align();
    const observer = new ResizeObserver(align);
    for (const element of [table, header, folders]) observer.observe(element);
    return () => {
      observer.disconnect();
      divider.style.removeProperty('--sheet-divider-offset');
    };
  }, [sheet]);
}

function emptyText(folder?: Folder): string {
  if (!folder) return 'No trades yet. Open CSFloat and flipbook syncs your trades on its own.';
  if (folder.id === HOLDS_ID) return 'Nothing here yet. Move items you bought to keep here and they stop counting as flips.';
  if (folder.id === OTHER_ID) return 'Nothing here. Sales with no buy on record land here on their own.';
  return 'This folder is empty. Drag rows onto it in the sidebar, or select rows and use Move to.';
}

function SheetNote({ folder }: { folder?: Folder }) {
  if (!folder) return null;
  if (folder.id === OTHER_ID) {
    return <p className="note">Sales with no buy on record land here on their own. To file a sale under Flips, select its row and choose Move to.</p>;
  }
  if (folder.id === HOLDS_ID) {
    return <p className="note">Items you bought to keep or use. They don't count toward your flip totals. When you decide to sell an item, select its row and choose Move to.</p>;
  }
  return <p className="note">Nothing in this folder counts toward your flip totals or the export.</p>;
}

function SheetKpis({ folder, rows, sync }: { folder?: Folder; rows: SheetRow[]; sync: SyncProps }) {
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
        <Kpi label="Total buy cost" value={formatMoney(sum(open, (row) => row.buyPrice))} />
        <HoldValue open={open} sync={sync} />
      </>
    );
  }

  const { closed, net, weightedPercent } = totalRows(rows);
  const wins = rows.filter((row) => row.net !== undefined && roundTo(row.net, 2) >= 0).length;
  return (
    <>
      <Kpi label="Net profit" value={net === undefined ? '—' : formatSignedMoney(net)} sign={net} />
      <Kpi label="Closed" value={closed} />
      <Kpi label="Win rate" value={closed ? `${Math.round((wins / closed) * 100)}%` : '—'} />
      <Kpi label="Weighted return" value={weightedPercent === undefined ? '—' : formatPercent(weightedPercent)} sign={weightedPercent} sub="On closed buy cost" />
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
  const { pricing } = sync;
  const status = pricing ? (
    <span className="pricing">
      <PageTurner pages={pricing.done} />
      Pricing {pricing.done} of {pricing.total}
    </span>
  ) : paused ? (
    'CSFloat asked for a break; prices resume soon'
  ) : priced.length === 0 ? (
    'Not priced yet'
  ) : (
    `${priced.length} of ${open.length} priced, ${formatTimeAgo(oldest!)}`
  );
  const { nowPrice, nowNet, pricedBuy } = totalRows(open);

  return (
    <>
      <Kpi label="Worth now" value={formatMoney(nowPrice) || '\u2014'}
        sub={pricedBuy !== undefined && priced.length < open.length ? `${formatMoney(pricedBuy)} buy cost for priced items` : undefined} />
      <Kpi label="Profit if sold" value={nowNet === undefined ? '\u2014' : formatSignedMoney(nowNet)} sign={nowNet}
        sub={nowNet === undefined ? undefined : 'After fees'} />
      <Kpi label="Longest held" value={open.length ? plural(open.reduce((days, row) => Math.max(days, row.held ?? 0), 0), 'day') : '\u2014'} />
      <div className="hold-pricing">
        <span className="hint" role="status">{status}</span>
        <button className="btn" onClick={sync.onRefreshPrices} disabled={refreshing || paused || pricing !== undefined}>
          {pricing ? 'Pricing\u2026' : refreshing ? 'Syncing\u2026' : 'Refresh prices'}
        </button>
        {pricing && (
          <div className="pricing-line" role="progressbar" aria-label="Pricing held items" aria-valuemin={0} aria-valuemax={pricing.total} aria-valuenow={pricing.done}>
            <i style={{ width: `${(pricing.done / pricing.total) * 100}%` }} />
          </div>
        )}
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

const SHEET_SORTS: Record<Sort['key'], string> = {
  bought: 'Bought date',
  name: 'Item name',
  buyPrice: 'Buy price',
  sellPrice: 'Sell price',
  net: 'Net profit',
  percent: 'Profit %',
  sold: 'Sold date',
  held: 'Time held',
  float: 'Float',
  adjusted: 'Adjusted float',
  nowPrice: 'Price now',
  nowNet: 'Profit if sold now',
  nowPercent: 'Profit % if sold now',
};
const SORT_OPTIONS = Object.entries(SHEET_SORTS) as [Sort['key'], string][];

export function sheetSortAvailable(key: Sort['key'], holds: boolean, hasSales: boolean): boolean {
  if (key === 'nowPrice' || key === 'nowNet' || key === 'nowPercent') return holds;
  if (key === 'sold' || key === 'sellPrice' || key === 'percent' || (holds && key === 'net')) return hasSales;
  return true;
}

function SheetSort({ sort, onSort, holds, hasSales }: { sort: Sort; onSort: (sort: Sort) => void; holds: boolean; hasSales: boolean }) {
  const reverseLabel = sort.descending ? 'Sort ascending' : 'Sort descending';
  const options = SORT_OPTIONS.filter(([key]) => sheetSortAvailable(key, holds, hasSales));
  return (
    <div className="sheet-sort">
      <label>
        <span>Sort by</span>
        <select className="btn" value={sort.key} onChange={(event) => {
          const option = options.find(([key]) => key === event.target.value);
          if (option) onSort({ key: option[0], descending: option[0] !== 'name' });
        }}>
          {options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <button className="btn sq" aria-label={reverseLabel} title={reverseLabel} onClick={() => onSort({ ...sort, descending: !sort.descending })}>
        <span aria-hidden="true">{sort.descending ? '↓' : '↑'}</span>
      </button>
    </div>
  );
}

function Toolbar({ view, shown, total, holds, hasSales, inspectorId, filtersVisible, onFilters }: {
  view: SheetView; shown: number; total: number; holds: boolean; hasSales: boolean; inspectorId?: string;
  filtersVisible: boolean; onFilters: () => void;
}) {
  const { kinds, result, excludedKinds, excludedResults } = view.filter;
  const activeFilters = kinds.length + (result === 'all' ? 0 : 1) + excludedKinds.length + excludedResults.length;
  return (
    <div className="toolbar">
      <label className="search-control">
        <Icon name="search" />
        <input
          type="search"
          className="search"
          value={view.filter.query}
          onChange={(event) => view.setFilter({ ...view.filter, query: event.target.value })}
          placeholder="Search items"
          aria-label="Search items"
          autoComplete="off"
        />
      </label>
      <button className="btn" aria-expanded={inspectorId ? undefined : filtersVisible} aria-controls={inspectorId ?? 'filters'} onClick={onFilters}>
        <Icon name="filter" /> Filters{activeFilters > 0 && <span className="badge">{activeFilters}</span>}
      </button>
      <SheetSort sort={view.sort} onSort={view.setSort} holds={holds} hasSales={hasSales} />
      <span className="count" aria-live="polite">{shown === total ? plural(total, 'row') : `${shown} of ${plural(total, 'row')}`}</span>
      <div className="tb-end">
        <div className="seg row-detail-toggle" role="group" aria-label="Row detail">
          {(Object.keys(ROW_DETAILS) as RowDetail[]).map((mode) => (
            <button key={mode} type="button" aria-pressed={view.detail === mode} onClick={() => view.setDetail(mode)}>{ROW_DETAILS[mode]}</button>
          ))}
          <span className="row-detail-highlight" aria-hidden="true">
            {Object.values(ROW_DETAILS).map((label) => <span key={label}>{label}</span>)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface SelectionBarProps {
  count: number;
  onMoveMenu: (trigger: HTMLButtonElement) => void;
  moveMenuOpen: boolean;
  onClear: () => void;
}

function SelectionBar({ count, onMoveMenu, moveMenuOpen, onClear }: SelectionBarProps) {
  return (
    <div className="toolbar selbar" role="region" aria-label="Selected rows">
      <strong>{count} selected</strong>
      <button className="btn pri" aria-haspopup="menu" aria-expanded={moveMenuOpen} onClick={(event) => onMoveMenu(event.currentTarget)}>Move to <span aria-hidden="true">▾</span></button>
      <button className="btn ghost" onClick={onClear}>Clear selection</button>
    </div>
  );
}

/** Only the kinds on this sheet get a chip. */
function Filters({ rows, filter, onChange, excluding, setExcluding }: {
  rows: SheetRow[]; filter: ListFilter; onChange: (filter: ListFilter) => void;
  excluding: boolean; setExcluding: (value: boolean) => void;
}) {
  const present = new Set(rows.map((row) => itemKind(row.item)));
  const kinds = ITEM_KINDS.filter((kind) => present.has(kind) || filter.kinds.includes(kind) || filter.excludedKinds.includes(kind));
  const hide = (event: MouseEvent, next: ListFilter) => {
    event.preventDefault();
    onChange(next);
  };

  return (
    <div className="filters" id="filters">
      <div className="seg filter-mode" role="group" aria-label="Filter action">
        <button type="button" aria-pressed={!excluding} onClick={() => setExcluding(false)}>Include</button>
        <button type="button" aria-pressed={excluding} onClick={() => setExcluding(true)}>Exclude</button>
      </div>
      <span className="flabel">Type</span>
      {kinds.map((kind) => (
        <button
          key={kind}
          className={filter.excludedKinds.includes(kind) ? 'chip excluded' : 'chip'}
          aria-pressed={filter.excludedKinds.includes(kind) || filter.kinds.includes(kind)}
          aria-label={filter.excludedKinds.includes(kind) ? `Clear exclusion for ${KIND_PLURAL[kind]}` : undefined}
          onClick={() => onChange(excluding || filter.excludedKinds.includes(kind) ? toggleExcludedKind(filter, kind) : toggleKind(filter, kind))}
          onContextMenu={(event) => hide(event, toggleExcludedKind(filter, kind))}
        >
          {KIND_PLURAL[kind]}{filter.excludedKinds.includes(kind) && <span aria-hidden="true"> ×</span>}
        </button>
      ))}
      <span className="flabel">Result</span>
      {RESULTS.filter((result) => !excluding || result.value !== 'all').map((result) => (
        <button
          key={result.value}
          className={filter.excludedResults.includes(result.value) ? 'chip excluded' : 'chip'}
          aria-pressed={filter.excludedResults.includes(result.value) || filter.result === result.value}
          aria-label={filter.excludedResults.includes(result.value) ? `Clear exclusion for ${result.label}` : undefined}
          onClick={() => onChange(excluding || filter.excludedResults.includes(result.value) ? toggleExcludedResult(filter, result.value) : pickResult(filter, result.value))}
          onContextMenu={(event) => hide(event, toggleExcludedResult(filter, result.value))}
        >
          {result.label}{filter.excludedResults.includes(result.value) && <span aria-hidden="true"> ×</span>}
        </button>
      ))}
      {isNarrowed(filter) && <button className="btn ghost" onClick={() => onChange(clearChips(filter))}>Clear filters</button>}
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
        <button className="btn sq" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => view.setPage(page - 1)}>‹</button>
        <span className="count">Page {page + 1} of {pageCount}</span>
        <button className="btn sq" aria-label="Next page" title="Next page" disabled={page >= pageCount - 1} onClick={() => view.setPage(page + 1)}>›</button>
      </div>
    </div>
  );
}
