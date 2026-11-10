import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Folder } from '../../domain/folders';
import { plural } from '../format';
import { NewFolderForm } from './NewFolderForm';

const EDGE_GAP = 8;

export interface MenuTarget {
  /** Null is the Flips sheet. */
  id: string | null;
  name: string;
}

interface Props {
  x: number;
  y: number;
  count: number;
  targets: MenuTarget[];
  /** Offered when a selected flip was paired by hand. */
  canUnpair: boolean;
  onMove: (folderId: string | null) => void;
  onFolderCreated: (folder: Folder) => void;
  onUnpair: () => void;
  onClose: () => void;
}

/** What to do with the selected rows. Opens at the pointer, or under the Move to button. */
export function MoveMenu({ x, y, count, targets, canUnpair, onMove, onFolderCreated, onUnpair, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [naming, setNaming] = useState(false);

  // Keep the whole menu on screen near the window's right and bottom edges.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    setPosition({
      left: Math.max(EDGE_GAP, Math.min(x, window.innerWidth - menu.offsetWidth - EDGE_GAP)),
      top: Math.max(EDGE_GAP, Math.min(y, window.innerHeight - menu.offsetHeight - EDGE_GAP)),
    });
  }, [x, y, naming, targets.length, canUnpair]);

  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // The Move to button toggles the menu itself.
      if (!ref.current?.contains(target) && !target.closest('[aria-haspopup="menu"]')) close.current();
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLButtonElement) || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
    const index = buttons.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
  };

  const title = `Move ${plural(count, 'row')} to`;
  return (
    <div ref={ref} className="menu" role="menu" aria-label={title} style={position} onKeyDown={navigate}>
      <div className="mh" aria-hidden="true">{title}</div>
      {targets.map((target) => (
        <button key={target.id ?? 'flips'} role="menuitem" onClick={() => onMove(target.id)}>{target.name}</button>
      ))}
      <hr />
      {naming ? (
        <NewFolderForm onCreated={onFolderCreated} onCancel={() => setNaming(false)} />
      ) : (
        <button role="menuitem" onClick={() => setNaming(true)}>New folder…</button>
      )}
      {canUnpair && <button role="menuitem" onClick={onUnpair}>Unpair sale</button>}
    </div>
  );
}
