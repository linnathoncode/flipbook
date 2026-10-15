import { useEffect, useRef, type MouseEvent } from 'react';
import { trackerDisplayName } from '../../domain/itemNames';
import type { Sort } from '../../domain/listFilters';
import type { Trade } from '../../domain/types';
import { rarityColor } from '../rarity';
import type { Entry, Selection } from '../useSelection';

export function EmptyState({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

/** CSS class that colors a number by whether it's a gain or a loss. */
export function signClass(value: number): string {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return '';
}

/** Whether a trade happened after `since`, e.g. the last visit. ISO strings compare in time order. */
export function isAfter(iso: string, since?: string): boolean {
  return since !== undefined && iso > since;
}

/** Rows typed into a spreadsheet keep the name the user wrote; synced rows use the tracker's naming. */
export function itemLabel(trade: Trade): string {
  return trade.source === 'xlsx' ? trade.item.itemName : trackerDisplayName(trade.item);
}

/** The name cell: CS2 rarity stripe, name, and NEW / PENDING tags. */
export function ItemName({ trade, isNew = false }: { trade: Trade; isNew?: boolean }) {
  return (
    <span className="item-name">
      <span className="rarity" style={{ background: rarityColor(trade.item) ?? 'transparent' }} aria-hidden="true" />
      {itemLabel(trade)}
      {isNew && <span className="tag tag-new">New</span>}
      {trade.state === 'pending' && <span className="tag tag-pending">Pending</span>}
    </span>
  );
}

interface SortHeaderProps<Key extends string> {
  label: string;
  sortKey: Key;
  sort: Sort<Key>;
  onSort: (sort: Sort<Key>) => void;
  className?: string;
}

/** Click to sort by this column; click again to flip the direction. New columns start highest/newest first. */
export function SortHeader<Key extends string>({ label, sortKey, sort, onSort, className = '' }: SortHeaderProps<Key>) {
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.descending ? 'descending' : 'ascending') : undefined;
  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        className={`sort-button ${active ? 'is-active' : ''}`}
        onClick={() => onSort({ key: sortKey, descending: active ? !sort.descending : true })}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">{active ? (sort.descending ? '↓' : '↑') : ''}</span>
      </button>
    </th>
  );
}

/**
 * Spreadsheet selection on a whole row: click selects it, Ctrl/Cmd-click adds it, Shift-click selects a range.
 * Clicks on the row's own buttons and links are left alone.
 */
export function selectableRow(entry: Entry, visible: Entry[], selection: Selection) {
  const selected = selection.has(entry.key);
  return {
    className: `row ${selected ? 'is-selected' : ''}`,
    'aria-selected': selected,
    // Shift-click would otherwise also select the text between the two rows.
    onMouseDown: (event: MouseEvent) => event.shiftKey && event.preventDefault(),
    onClick: (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('button, a, input')) return;
      selection.click(entry, { add: event.ctrlKey || event.metaKey, range: event.shiftKey }, visible);
    },
  };
}

interface RowCheckProps {
  entry: Entry;
  visible: Entry[];
  selection: Selection;
  label: string;
}

/** The keyboard way in: a checkbox adds or removes its row, Shift extends a range. */
export function RowCheck({ entry, visible, selection, label }: RowCheckProps) {
  // Click (not change) carries the shift key needed for range selection.
  const onClick = (event: MouseEvent<HTMLInputElement>) => selection.click(entry, { add: true, range: event.shiftKey }, visible);
  return (
    <input
      type="checkbox"
      className="row-check"
      checked={selection.has(entry.key)}
      onClick={onClick}
      onChange={() => undefined}
      aria-label={`Select ${label}`}
    />
  );
}

export function SelectAllCheck({ visible, selection }: { visible: Entry[]; selection: Selection }) {
  const selectedCount = visible.filter((entry) => selection.has(entry.key)).length;
  const all = visible.length > 0 && selectedCount === visible.length;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selectedCount > 0 && !all;
  }, [selectedCount, all]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="row-check"
      checked={all}
      onChange={() => selection.setAll(visible, !all)}
      aria-label="Select all shown"
    />
  );
}
