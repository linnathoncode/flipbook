import { useState } from 'react';
import { moveTrades } from '../../app/actions';
import type { Folder } from '../../domain/folders';
import type { Selection } from '../useSelection';
import { NewFolderForm } from './Sidebar';

interface Props {
  selection: Selection;
  folders: Folder[];
  /** The folder being viewed, if any; moving there again isn't offered. */
  currentFolderId?: string;
  onChange: () => void;
}

/** Appears while rows are selected; moves them between the book and folders. */
export function SelectionBar({ selection, folders, currentFolderId, onChange }: Props) {
  const [creating, setCreating] = useState(false);
  if (selection.count === 0) return null;

  const move = async (folderId: string | null) => {
    await moveTrades(selection.tradeIds(), folderId);
    selection.clear();
    setCreating(false);
    onChange();
  };

  return (
    <div className="selection-bar" role="region" aria-label="Selected rows">
      <span className="selection-count">{selection.count} selected</span>
      <span className="selection-label">Move to</span>
      {currentFolderId && (
        <button className="button button-small" onClick={() => move(null)}>Book</button>
      )}
      {folders
        .filter((folder) => folder.id !== currentFolderId)
        .map((folder) => (
          <button key={folder.id} className="button button-small" onClick={() => move(folder.id)}>
            {folder.name}
          </button>
        ))}
      {creating ? (
        <NewFolderForm autoFocus onCreated={(folder) => move(folder.id)} />
      ) : (
        <button className="button button-small" onClick={() => setCreating(true)}>+ New folder</button>
      )}
      <button className="text-button selection-clear" onClick={selection.clear}>Clear selection</button>
    </div>
  );
}
