import { useEffect, useRef, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { adjustedFloat, floatRange, type FloatRange } from '../../domain/floatRanges';
import { totalRows, type SheetRow, type Sort } from '../../domain/listFilters';
import type { Item } from '../../domain/types';
import { formatDate, formatDays, formatFloat, formatMoney, formatPercent, formatSignedMoney, plural } from '../format';
import { rarityColor } from '../rarity';
import { steamImageUrl } from '../steamImages';
import type { Entry, Selection } from '../useSelection';
import { HoverCardProvider, useHoverCard, type CardContent } from './HoverCard';
import { CONFIDENCE, isAfter, itemTitle, signClass, SortHeader } from './shared';

export type RowDetail = 'compact' | 'detailed';

interface Props {
  /** The rows on this page. */
  rows: SheetRow[];
  /** Every row that passed the filters; the totals cover all of them, not just this page. */
  allRows: SheetRow[];
  detail: RowDetail;
  sort: Sort;
  onSort: (sort: Sort) => void;
  selection: Selection;
  /** Trades after this get a "New" tag. */
  newSince?: string;
  empty: ReactNode;
  onRowMenu: (event: MouseEvent, row: SheetRow) => void;
  onRowDrag: (event: DragEvent, row: SheetRow) => void;
  onPickBuy: () => void;
}

export const rowEntry = (row: SheetRow): Entry => ({ key: row.key, tradeIds: row.tradeIds });

export function SheetTable({ rows, allRows, detail, sort, onSort, selection, newSince, empty, onRowMenu, onRowDrag, onPickBuy }: Props) {
  const detailed = detail === 'detailed';
  const visible = rows.map(rowEntry);
  const totals = totalRows(allRows);
  const header = { sort, onSort };
  const columnCount = detailed ? 13 : 12;

  return (
    <HoverCardProvider>
    <table className="sheet">
      <thead>
        <tr>
          <th className="chk"><PageCheck visible={visible} selection={selection} /></th>
          <SortHeader label="Bought" sortKey="bought" {...header} />
          <SortHeader label="Item" sortKey="name" {...header} />
          <SortHeader label="Float" sortKey="float" numeric {...header} />
          {detailed && <SortHeader label="Adj. float" sortKey="adjusted" numeric title="Where the float sits inside this skin's own range. Trade-ups use this." {...header} />}
          <SortHeader label="Buy" sortKey="buyPrice" numeric {...header} />
          <SortHeader label="Sold" sortKey="sold" {...header} />
          <SortHeader label="Sell" sortKey="sellPrice" numeric {...header} />
          <th className="n">Fee</th>
          <SortHeader label="Net" sortKey="net" numeric {...header} />
          <SortHeader label="%" sortKey="percent" numeric {...header} />
          <SortHeader label="Held" sortKey="held" numeric {...header} />
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columnCount} className="empty">{empty}</td>
          </tr>
        )}
        {rows.map((row, index) => {
          const entry = visible[index];
          const selected = selection.has(row.key);
          const result = row.net === undefined ? '' : row.net >= 0 ? 'win' : 'loss';
          const isNew = isAfter(row.boughtAt, newSince) || isAfter(row.soldAt, newSince);
          const select = (event: MouseEvent) => {
            if ((event.target as HTMLElement).closest('button, a')) return;
            const fromCheckbox = (event.target as HTMLElement).matches('input');
            selection.click(entry, { add: fromCheckbox || event.ctrlKey || event.metaKey, range: event.shiftKey }, visible);
          };
          return (
            <tr
              key={row.key}
              className={`row ${row.status} ${result} ${selected ? 'sel' : ''}`}
              aria-selected={selected}
              draggable
              onDragStart={(event) => onRowDrag(event, row)}
              onContextMenu={(event) => onRowMenu(event, row)}
              // Shift-click would otherwise also select the text between the two rows.
              onMouseDown={(event) => event.shiftKey && event.preventDefault()}
              onClick={select}
            >
              <td className="chk">
                <input type="checkbox" tabIndex={-1} checked={selected} onChange={() => undefined} aria-label={`Select ${row.item.marketHashName}`} />
              </td>
              <td className="n m">{formatDate(row.boughtAt)}</td>
              <td><ItemCell row={row} detailed={detailed} isNew={isNew} /></td>
              <td className="n m"><FloatCell item={row.item} detailed={detailed} /></td>
              {detailed && <td className="n"><AdjustedFloatCell item={row.item} /></td>}
              <td className="n">{formatMoney(row.buyPrice)}</td>
              <td className="n m">{formatDate(row.soldAt)}</td>
              <td className="n">{formatMoney(row.sellPrice)}</td>
              <td className="n m">{formatMoney(row.fee)}</td>
              <td className={`n pl ${signClass(row.net)}`}><NetCell row={row} onPickBuy={onPickBuy} /></td>
              <td className={`n pl ${signClass(row.percent)}`}>{row.percent === undefined ? '' : formatPercent(row.percent)}</td>
              <td className="n m">{formatDays(row.held)}</td>
              <td>{row.match && <MatchLabel confidence={row.match} />}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td className="chk" />
          <td colSpan={detailed ? 4 : 3}>{plural(totals.rows, 'row')}</td>
          <td className="n">{formatMoney(totals.buy)}</td>
          <td />
          <td className="n">{formatMoney(totals.sell)}</td>
          <td className="n m">{formatMoney(totals.fee)}</td>
          <td className={`n pl ${signClass(totals.net)}`}>{totals.net === undefined ? '' : formatSignedMoney(totals.net)}</td>
          <td className={`n pl ${signClass(totals.weightedPercent)}`} title="Net profit over what the closed flips cost">
            {totals.weightedPercent === undefined ? '' : formatPercent(totals.weightedPercent)}
          </td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
    </HoverCardProvider>
  );
}

function NetCell({ row, onPickBuy }: { row: SheetRow; onPickBuy: () => void }) {
  if (row.status === 'open') return <span className="tag open">Open</span>;
  if (row.ambiguous) return <button className="link" onClick={onPickBuy}>Pick buy</button>;
  if (row.status === 'sale') return <span className="tag open">No buy</span>;
  return <>{row.net === undefined ? '' : formatSignedMoney(row.net)}</>;
}

function MatchLabel({ confidence }: { confidence: SheetRow['match'] & string }) {
  const { label, hint } = CONFIDENCE[confidence];
  return <span className={`match ${confidence === 'suggested' ? 'check' : ''}`} title={hint}>{label}</span>;
}

function ItemCell({ row, detailed, isNew }: { row: SheetRow; detailed: boolean; isNew: boolean }) {
  const { item } = row;
  const title = itemTitle(item, (row.sell ?? row.buy)?.source);
  const pending = [row.buy, row.sell].some((trade) => trade?.state === 'pending');
  const tags = (
    <>
      {isNew && <span className="tag new">New</span>}
      {pending && <span className="tag pending">Pending</span>}
    </>
  );
  const color = rarityColor(item) ?? 'var(--rule)';
  const hover = useHoverCard();
  const seed = item.paintSeed !== undefined && item.floatValue !== undefined ? `Seed ${item.paintSeed}` : undefined;
  const fade = item.fadePercent !== undefined ? `Fade ${item.fadePercent.toFixed(1)}%` : undefined;
  const card: CardContent = {
    iconUrl: item.iconUrl,
    title: title.name,
    lines: [title.longDetail, item.floatValue === undefined ? undefined : `Float ${item.floatValue}`, seed, fade].filter(isText),
    shape: 'item',
    color,
  };

  if (!detailed) {
    return (
      <div className="itm">
        <span className="rar" style={{ '--r': color } as CSSProperties} aria-hidden="true" />
        <span className="nm" {...hover(card)}>{title.name}</span>
        {title.detail && <span className="wear">{title.detail}</span>}
        {tags}
      </div>
    );
  }

  const facts = [title.longDetail, seed, fade].filter(isText);
  return (
    <div className="itm">
      <span className="tile" style={{ '--r': color } as CSSProperties} aria-hidden="true" {...hover(card)}>
        <SteamImage iconUrl={item.iconUrl} width={128} height={96} />
      </span>
      <div className="itm-text">
        <div className="nm">{title.name}{tags}</div>
        <div className="sub">
          {facts.join(' · ')}
          <Accessories item={item} />
        </div>
      </div>
    </div>
  );
}

function Accessories({ item }: { item: Item }) {
  const stickers = [...(item.stickers ?? [])].sort((a, b) => a.slot - b.slot);
  const charms = item.charms ?? [];
  const hover = useHoverCard();
  if (stickers.length === 0 && charms.length === 0) return null;
  return (
    <span className="acc">
      {stickers.map((sticker, index) => (
        <span key={index} className="stk" aria-label={sticker.name} {...hover({ iconUrl: sticker.iconUrl, title: withoutPrefix(sticker.name), lines: [scrapeNote(sticker.wear)], shape: 'square' })}>
          <SteamImage iconUrl={sticker.iconUrl} width={64} fallback={withoutPrefix(sticker.name).charAt(0)} />
        </span>
      ))}
      {charms.map((charm, index) => (
        <span
          key={index}
          className="charm"
          aria-label={charm.name}
          {...hover({ iconUrl: charm.iconUrl, title: withoutPrefix(charm.name), lines: charm.pattern === undefined ? ['Charm'] : [`Charm, pattern #${charm.pattern}`], shape: 'square' })}
        >
          <SteamImage iconUrl={charm.iconUrl} width={64} fallback="" />
          {charm.pattern !== undefined && <span>#{charm.pattern}</span>}
        </span>
      ))}
    </span>
  );
}

function scrapeNote(wear?: number): string {
  return wear ? `${Math.round(wear * 100)}% scraped` : 'Not scraped';
}

/** "Sticker | Crown (Foil)" reads as just "Crown (Foil)" under a picture of the sticker. */
const withoutPrefix = (name: string) => name.replace(/^(Sticker|Patch|Charm) \| /, '');

const isText = (value: string | undefined): value is string => Boolean(value);

/** Hides itself if Steam doesn't answer, leaving the tile's rarity color or the fallback letter. */
function SteamImage({ iconUrl, width, height = width, fallback }: { iconUrl?: string; width: number; height?: number; fallback?: string }) {
  const src = steamImageUrl(iconUrl, width, height);
  if (!src) return fallback ? <span className="fallback">{fallback}</span> : null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(event) => event.currentTarget.classList.add('in')}
      onError={(event) => (event.currentTarget.hidden = true)}
    />
  );
}

const rangeText = (range: FloatRange) => `${range.min.toFixed(2)} to ${range.max.toFixed(2)}`;

function FloatCell({ item, detailed }: { item: Item; detailed: boolean }) {
  const range = floatRange(item);
  if (!range || item.floatValue === undefined) return null;
  if (!detailed) return <span title={String(item.floatValue)}>{formatFloat(item.floatValue)}</span>;
  const bar = { '--f': item.floatValue, '--lo': range.min, '--hi': range.max } as CSSProperties;
  return (
    <span className="flt" title={String(item.floatValue)}>
      <span>{formatFloat(item.floatValue, 6)}</span>
      <span className="wbar" style={bar} title={`${item.wearName ?? 'Wear'}. This skin's floats run ${rangeText(range)}.`}>
        <b className="cap l" />
        <b className="cap r" />
        <i />
      </span>
    </span>
  );
}

function AdjustedFloatCell({ item }: { item: Item }) {
  const range = floatRange(item);
  const adjusted = adjustedFloat(item);
  if (!range || adjusted === undefined) return null;
  return (
    <span className="flt">
      <span>{formatFloat(adjusted)}</span>
      <span className="capt">of {rangeText(range)}</span>
    </span>
  );
}

/** Selects or clears every row on this page. */
function PageCheck({ visible, selection }: { visible: Entry[]; selection: Selection }) {
  const selectedCount = visible.filter((entry) => selection.has(entry.key)).length;
  const all = visible.length > 0 && selectedCount === visible.length;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selectedCount > 0 && !all;
  }, [selectedCount, all]);
  return (
    <input ref={ref} type="checkbox" checked={all} onChange={() => selection.setAll(visible, !all)} aria-label="Select every row on this page" />
  );
}
