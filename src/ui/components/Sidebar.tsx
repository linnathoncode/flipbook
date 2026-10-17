import { useState, type DragEvent, type ReactNode } from 'react';
import { exportWorkbook } from '../../app/actions';
import { errorText } from '../../app/sync';
import type { Folder } from '../../domain/folders';
import { isSamePlace, type Place } from '../places';
import { NewFolderForm } from './NewFolderForm';

const EXPORT_FILE_NAME = 'cs trades.xlsx';

export interface PlaceCounts {
  flips: number;
  review: number;
  folders: Map<string, number>;
}

interface Props {
  place: Place;
  onNavigate: (place: Place) => void;
  folders: Folder[];
  counts: PlaceCounts;
  /** Rows dropped on Flips (null) or a folder. */
  onDropRows: (folderId: string | null) => void;
  onFolderCreated: (folder: Folder) => void;
}

export function Sidebar({ place, onNavigate, folders, counts, onDropRows, onFolderCreated }: Props) {
  const [creating, setCreating] = useState(false);

  const item = (target: Place, label: string, extra?: ReactNode, dropTo?: string | null) => (
    <NavItem
      key={target.kind === 'folder' ? target.folderId : target.kind}
      label={label}
      current={isSamePlace(place, target)}
      onClick={() => onNavigate(target)}
      onDrop={dropTo === undefined ? undefined : () => onDropRows(dropTo)}
    >
      {extra}
    </NavItem>
  );

  return (
    <nav className="nav" aria-label="Sheets">
      <div className="brand">
        <span className="logo" aria-hidden="true">F</span>
        Flipbook
      </div>
      <div className="nav-sec">
        {item({ kind: 'flips' }, 'Flips', <Count n={counts.flips} />, null)}
        {folders.map((folder) =>
          item({ kind: 'folder', folderId: folder.id }, folder.name, <Count n={counts.folders.get(folder.id) ?? 0} />, folder.id),
        )}
        {creating ? (
          <NewFolderForm
            onCreated={(folder) => {
              setCreating(false);
              onFolderCreated(folder);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button className="nav-item dim" onClick={() => setCreating(true)}>+ New folder</button>
        )}
      </div>
      <div className="nav-gap" aria-hidden="true" />
      <div className="nav-sec">
        {item({ kind: 'review' }, 'Needs review', <Count n={counts.review} alert={counts.review > 0} />)}
        {item({ kind: 'analytics' }, 'Analytics')}
      </div>
      <div className="nav-foot">
        <ExportButton />
        {item({ kind: 'settings' }, 'Settings')}
      </div>
    </nav>
  );
}

interface NavItemProps {
  label: string;
  current: boolean;
  onClick: () => void;
  /** Set on places rows can be dragged onto. */
  onDrop?: () => void;
  children?: ReactNode;
}

function NavItem({ label, current, onClick, onDrop, children }: NavItemProps) {
  const [over, setOver] = useState(false);
  // Dropping rows where they already are does nothing, so the current page isn't a target.
  const droppable = onDrop !== undefined && !current;
  const dragProps = droppable
    ? {
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          onDrop();
        },
      }
    : {};
  return (
    <button className={`nav-item ${over ? 'over' : ''}`} aria-current={current ? 'page' : undefined} onClick={onClick} {...dragProps}>
      <span>{label}</span>
      {children}
    </button>
  );
}

function Count({ n, alert = false }: { n: number; alert?: boolean }) {
  return <span className={`cnt ${alert ? 'alert' : ''}`}>{n}</span>;
}

/** Downloads the Flips sheet in the tracker's layout, with live formulas. */
function ExportButton() {
  const [status, setStatus] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const download = async () => {
    setStatus({ busy: true });
    try {
      const url = URL.createObjectURL(await exportWorkbook());
      Object.assign(document.createElement('a'), { href: url, download: EXPORT_FILE_NAME }).click();
      URL.revokeObjectURL(url);
      setStatus({ busy: false });
    } catch (cause) {
      setStatus({ busy: false, error: `Export failed: ${errorText(cause)}` });
    }
  };

  return (
    <>
      {status.error && <p className="nav-error" role="alert">{status.error}</p>}
      <button className="nav-item dim" onClick={download} disabled={status.busy}>
        {status.busy ? 'Building spreadsheet…' : 'Export .xlsx'}
      </button>
    </>
  );
}
