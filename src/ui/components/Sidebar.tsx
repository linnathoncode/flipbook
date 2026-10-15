import { useState, type FormEvent, type ReactNode } from 'react';
import { createFolder } from '../../app/actions';
import type { Folder } from '../../domain/folders';
import { isSamePlace, type Place } from '../places';

export interface PlaceCounts {
  flips: number;
  holding: number;
  review: number;
  folders: Map<string, number>;
}

interface Props {
  place: Place;
  onNavigate: (place: Place) => void;
  folders: Folder[];
  counts: PlaceCounts;
  onChange: () => void;
  children?: ReactNode;
}

export function Sidebar({ place, onNavigate, folders, counts, onChange, children }: Props) {
  const link = (target: Place, label: string, count?: number) => (
    <button
      key={target.kind === 'folder' ? target.folderId : target.kind}
      className="nav-link"
      aria-current={isSamePlace(place, target) ? 'page' : undefined}
      onClick={() => onNavigate(target)}
    >
      <span className="nav-label">{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );

  return (
    <aside className="sidebar">
      <nav aria-label="Book">
        <h2 className="sidebar-title">Book</h2>
        {link({ kind: 'flips' }, 'Flips', counts.flips)}
        {link({ kind: 'holding' }, 'Holding', counts.holding)}
        {link({ kind: 'review' }, 'Needs review', counts.review)}
      </nav>

      <nav aria-label="Folders">
        <h2 className="sidebar-title">Folders</h2>
        {folders.length === 0 && <p className="sidebar-hint">Set aside cases, long holds and anything that isn't a flip.</p>}
        {folders.map((folder) => link({ kind: 'folder', folderId: folder.id }, folder.name, counts.folders.get(folder.id)))}
        <NewFolderForm onCreated={(folder) => { onChange(); onNavigate({ kind: 'folder', folderId: folder.id }); }} />
      </nav>

      {children}

      <nav aria-label="Settings">
        {link({ kind: 'data' }, 'Import, export & fees')}
      </nav>
    </aside>
  );
}

export function NewFolderForm({ onCreated, autoFocus = false }: { onCreated: (folder: Folder) => void; autoFocus?: boolean }) {
  const [open, setOpen] = useState(autoFocus);
  const [name, setName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const folder = await createFolder(name);
    setName('');
    setOpen(false);
    onCreated(folder);
  };

  if (!open) {
    return <button className="nav-link nav-add" onClick={() => setOpen(true)}>+ New folder</button>;
  }
  return (
    <form className="new-folder" onSubmit={submit}>
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder="Folder name"
        aria-label="New folder name"
        maxLength={40}
      />
      <button className="button button-small" type="submit">Add</button>
    </form>
  );
}
