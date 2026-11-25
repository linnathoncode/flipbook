import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { exportWorkbook } from '../../app/actions';
import { errorText } from '../../app/sync';
import type { Folder } from '../../domain/folders';
import { isSamePlace, type Place } from '../places';
import { Icon } from './Icon';
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
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const sheetPicker = useRef<HTMLDivElement>(null);
  const sheetTrigger = useRef<HTMLButtonElement>(null);
  const sheetsId = useId();
  const sheetName = place.kind === 'folder' ? folders.find((folder) => folder.id === place.folderId)?.name
    : place.kind === 'flips' ? 'Flips' : undefined;

  useEffect(() => {
    if (!sheetsOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!sheetPicker.current?.contains(event.target as Node)) setSheetsOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [sheetsOpen]);

  const item = (target: Place, label: string, extra?: ReactNode, dropTo?: string | null) => (
    <NavItem
      key={target.kind === 'folder' ? target.folderId : target.kind}
      label={label}
      icon={target.kind}
      current={isSamePlace(place, target)}
      onClick={() => {
        if (sheetsOpen && dropTo !== undefined) sheetTrigger.current?.focus();
        setSheetsOpen(false);
        onNavigate(target);
      }}
      onDrop={dropTo === undefined ? undefined : () => {
        setSheetsOpen(false);
        onDropRows(dropTo);
      }}
    >
      {extra}
    </NavItem>
  );

  return (
    <nav className="nav" aria-label="Sheets">
      <div className="brand">
        <img className="logo" src="./icons/48.png" alt="" />
        flipbook
      </div>
      <div className="sheet-picker" ref={sheetPicker}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setSheetsOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !sheetsOpen || event.target instanceof HTMLInputElement) return;
          event.preventDefault();
          setSheetsOpen(false);
          sheetTrigger.current?.focus();
        }}>
        <button className="nav-item sheet-picker-trigger" ref={sheetTrigger} type="button"
          aria-label={sheetName ? `Sheets, current sheet: ${sheetName}` : 'Sheets'}
          aria-expanded={sheetsOpen} aria-controls={sheetsId}
          onDragEnter={(event) => {
            if (event.dataTransfer.types.includes('text/plain')) setSheetsOpen(true);
          }}
          onClick={() => setSheetsOpen(!sheetsOpen)}>
          <Icon name={place.kind === 'flips' ? 'flips' : 'folder'} />
          <span>{sheetName ?? 'Sheets'}</span>
          <Icon name="chevronDown" />
        </button>
        <div className="nav-sec sheet-picker-list" id={sheetsId} data-open={sheetsOpen || undefined}>
          <div className="nav-sec sheet-picker-links">
            {item({ kind: 'flips' }, 'Flips', <Count n={counts.flips} />, null)}
            {folders.map((folder) =>
              item({ kind: 'folder', folderId: folder.id }, folder.name, <Count n={counts.folders.get(folder.id) ?? 0} />, folder.id),
            )}
          </div>
          {creating ? (
            <NewFolderForm
              onCreated={(folder) => {
                setCreating(false);
                onFolderCreated(folder);
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button className="nav-item dim" onClick={() => setCreating(true)}><Icon name="add" /> <span>New folder</span></button>
          )}
        </div>
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
  icon: Place['kind'];
  current: boolean;
  onClick: () => void;
  /** Set on places rows can be dragged onto. */
  onDrop?: () => void;
  children?: ReactNode;
}

function NavItem({ label, icon, current, onClick, onDrop, children }: NavItemProps) {
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
    <button className={`nav-item ${over ? 'over' : ''}`} title={label} aria-current={current ? 'page' : undefined} onClick={onClick} {...dragProps}>
      <Icon name={icon} />
      <span title={label}>{label}</span>
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
      <button className="nav-item dim" title="Export .xlsx" onClick={download} disabled={status.busy}>
        <Icon name="export" />
        <span>{status.busy ? 'Building spreadsheet\u2026' : 'Export .xlsx'}</span>
      </button>
    </>
  );
}
