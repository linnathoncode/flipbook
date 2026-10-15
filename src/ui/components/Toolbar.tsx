import { useState } from 'react';
import { moveTrades } from '../../app/actions';
import type { Folder } from '../../domain/folders';
import type { Selection } from '../useSelection';
import { NewFolderForm } from './NewFolderForm';

interface SelectionProps {
  selection: Selection;
  folders: Folder[];
  /** The folder being viewed, if any; moving there again isn't offered. */
  currentFolderId?: string;
  onChange: () => void;
}

interface Props extends SelectionProps {
  query: string;
  onQuery: (query: string) => void;
  activeFilters: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  shown: number;
  total: number;
  /** Singular; an "s" is added for any other count. */
  noun: string;
}

/** Search and filters; while rows are selected, what to do with them instead. */
export function Toolbar(props: Props) {
  if (props.selection.count > 0) return <SelectionActions {...props} />;

  const { query, onQuery, activeFilters, filtersOpen, onToggleFilters, shown, total, noun } = props;
  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search items"
        aria-label="Search items"
      />
      <button className="button" aria-expanded={filtersOpen} aria-controls="filter-drawer" onClick={onToggleFilters}>
        <FilterIcon />
        Filters
        {activeFilters > 0 && <span className="count-badge">{activeFilters}</span>}
      </button>
      <span className="result-count" aria-live="polite">
        {shown === total ? total : `${shown} of ${total}`} {total === 1 ? noun : `${noun}s`}
      </span>
      <span className="toolbar-hint">Click a row to select it, Ctrl-click to add, Shift-click for a range</span>
    </div>
  );
}

/** Moves the selected rows between the book and folders. */
export function SelectionActions({ selection, folders, currentFolderId, onChange }: SelectionProps) {
  const [creating, setCreating] = useState(false);

  const move = async (folderId: string | null) => {
    await moveTrades(selection.tradeIds(), folderId);
    selection.clear();
    setCreating(false);
    onChange();
  };

  return (
    <div className="toolbar" role="region" aria-label="Selected rows">
      <strong className="selection-count">{selection.count} selected</strong>
      <span className="muted">Move to</span>
      {currentFolderId && <button className="button" onClick={() => move(null)}>Book</button>}
      {folders
        .filter((folder) => folder.id !== currentFolderId)
        .map((folder) => (
          <button key={folder.id} className="button" onClick={() => move(folder.id)}>{folder.name}</button>
        ))}
      {creating ? (
        <NewFolderForm onCreated={(folder) => move(folder.id)} onCancel={() => setCreating(false)} />
      ) : (
        <button className="button button-primary" onClick={() => setCreating(true)}>New folder…</button>
      )}
      <button className="text-button toolbar-end" onClick={selection.clear}>Clear selection</button>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
