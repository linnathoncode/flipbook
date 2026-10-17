import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Folder } from '../../domain/folders';
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
  /** Offered unless the rows are already in Other. */
  canSendToOther: boolean;
  /** Offered when a selected flip was paired by hand. */
  canUnpair: boolean;
  onMove: (folderId: string | null) => void;
  onFolderCreated: (folder: Folder) => void;
  onUnpair: () => void;
  onClear: () => void;
  onClose: () => void;
}

/** What to do with the selected rows. Opens at the pointer, or under the Move to button. */
export function MoveMenu({ x, y, count, targets, canSendToOther, canUnpair, onMove, onFolderCreated, onUnpair, onClear, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [naming, setNaming] = useState(false);

  // Keep the whole menu on screen near the window's right and bottom edges.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(EDGE_GAP, Math.min(x, window.innerWidth - width - EDGE_GAP)),
      top: Math.max(EDGE_GAP, Math.min(y, window.innerHeight - height - EDGE_GAP)),
    });
  }, [x, y, naming]);

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

  return (
    <div ref={ref} className="menu" role="menu" style={position}>
      <div className="mh">Move {count} to</div>
      {targets.map((target) => (
        <button key={target.id ?? 'flips'} role="menuitem" onClick={() => onMove(target.id)}>{target.name}</button>
      ))}
      {naming ? (
        <NewFolderForm onCreated={onFolderCreated} onCancel={() => setNaming(false)} />
      ) : (
        <button role="menuitem" onClick={() => setNaming(true)}>New folder…</button>
      )}
      <hr />
      {canSendToOther && <button role="menuitem" onClick={() => onMove('other')}>Not a flip, move to Other</button>}
      {canUnpair && <button role="menuitem" onClick={onUnpair}>Unpair, let Flipbook match it again</button>}
      <button role="menuitem" onClick={onClear}>Clear selection</button>
    </div>
  );
}
