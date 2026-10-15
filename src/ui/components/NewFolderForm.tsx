import { useState, type FormEvent } from 'react';
import { createFolder } from '../../app/actions';
import type { Folder } from '../../domain/folders';

interface Props {
  onCreated: (folder: Folder) => void;
  onCancel: () => void;
}

export function NewFolderForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreated(await createFolder(name));
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
        placeholder="Folder name"
        aria-label="New folder name"
        maxLength={40}
      />
      <button className="button" type="submit">Add</button>
    </form>
  );
}
