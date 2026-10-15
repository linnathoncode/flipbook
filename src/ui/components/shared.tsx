import { useEffect, useRef, type MouseEvent } from 'react';
import type { Sort } from '../../domain/listFilters';
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

interface RowCheckProps {
  entry: Entry;
  visible: Entry[];
  selection: Selection;
  label: string;
}

export function RowCheck({ entry, visible, selection, label }: RowCheckProps) {
  // Click (not change) carries the shift key needed for range selection.
  const onClick = (event: MouseEvent<HTMLInputElement>) => selection.toggle(entry, event.shiftKey, visible);
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
