import { useState, type FormEvent } from 'react';
import { createFolder } from '../../app/actions';
import type { Folder } from '../../domain/folders';

interface Props {
  onCreated: (folder: Folder) => void;
  onCancel: () => void;
}

/** A name field; Enter makes the folder, Escape or leaving it empty cancels. */
export function NewFolderForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return onCancel();
    onCreated(await createFolder(name));
  };

  return (
    <form className="nf" onSubmit={submit}>
      <input
        className="search"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
        onBlur={() => !name.trim() && onCancel()}
        placeholder="Folder name, then Enter"
        aria-label="New folder name"
        maxLength={32}
        autoComplete="off"
      />
    </form>
  );
}
