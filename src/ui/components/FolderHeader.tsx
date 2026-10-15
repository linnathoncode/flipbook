import { useState, type FormEvent } from 'react';
import { deleteFolder, renameFolder } from '../../app/actions';
import type { Folder } from '../../domain/folders';

interface Props {
  folder: Folder;
  itemCount: number;
  onChange: () => void;
  onDeleted: () => void;
}

export function FolderHeader({ folder, itemCount, onChange, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) await renameFolder(folder, name);
    setEditing(false);
    onChange();
  };

  const remove = async () => {
    const items = itemCount === 1 ? '1 item goes' : `${itemCount} items go`;
    if (!window.confirm(`Delete "${folder.name}"? Its ${items} back to the book.`)) return;
    await deleteFolder(folder.id);
    onDeleted();
  };

  if (editing) {
    return (
      <form className="folder-header" onSubmit={rename}>
        <input
          className="folder-name-input"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
          aria-label="Folder name"
          maxLength={40}
        />
        <button className="button button-small" type="submit">Save</button>
      </form>
    );
  }

  return (
    <div className="folder-header">
      <h1 className="folder-name">{folder.name}</h1>
      <button className="text-button" onClick={() => { setName(folder.name); setEditing(true); }}>Rename</button>
      <button className="text-button text-button-danger" onClick={remove}>Delete folder</button>
    </div>
  );
}
