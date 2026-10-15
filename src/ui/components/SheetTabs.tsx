import { useState } from 'react';
import { exportWorkbook } from '../../app/actions';
import { errorText } from '../../app/sync';
import type { Folder } from '../../domain/folders';
import { isSamePlace, type Place } from '../places';
import { NewFolderForm } from './NewFolderForm';

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
}

const EXPORT_FILE_NAME = 'cs trades.xlsx';

/** Spreadsheet-style tabs along the bottom: the book's sheets, then one per folder. */
export function SheetTabs({ place, onNavigate, folders, counts, onChange }: Props) {
  const [creating, setCreating] = useState(false);

  const tab = (target: Place, label: string, count?: number) => (
    <button
      key={target.kind === 'folder' ? target.folderId : target.kind}
      className="tab"
      aria-current={isSamePlace(place, target) ? 'page' : undefined}
      onClick={() => onNavigate(target)}
    >
      {label}
      {count !== undefined && <span className="tab-count">{count}</span>}
    </button>
  );

  return (
    <nav className="tabs" aria-label="Sheets">
      {tab({ kind: 'flips' }, 'Flips', counts.flips)}
      {tab({ kind: 'holding' }, 'Holding', counts.holding)}
      {tab({ kind: 'review' }, 'Needs review', counts.review)}
      {folders.map((folder) => tab({ kind: 'folder', folderId: folder.id }, folder.name, counts.folders.get(folder.id)))}
      {creating ? (
        <NewFolderForm
          onCreated={(folder) => {
            setCreating(false);
            onChange();
            onNavigate({ kind: 'folder', folderId: folder.id });
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button className="text-button tabs-add" onClick={() => setCreating(true)}>+ New folder</button>
      )}
      <span className="tabs-end">
        <ExportButton />
        {tab({ kind: 'settings' }, 'Settings')}
      </span>
    </nav>
  );
}

/** Downloads the book as the user's tracker layout, with live formulas. */
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
      {status.error && <span className="sync-label is-error" role="alert">{status.error}</span>}
      <button className="text-button" onClick={download} disabled={status.busy}>
        {status.busy ? 'Building spreadsheet…' : 'Export .xlsx'}
      </button>
    </>
  );
}
