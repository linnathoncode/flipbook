import { useState, type ChangeEvent, type ReactNode } from 'react';
import {
  exportWorkbook,
  importTrackerWorkbook,
  importTradesJson,
  syncFromCsfloat,
  updateFeeRate,
  type ImportSummary,
} from '../../app/actions';
import { errorMessage } from '../useJournal';

interface Props {
  feeRate: number;
  onChange: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'done'; text: string }
  | { kind: 'error'; text: string };

const PERCENT = 100;
const EXPORT_FILE_NAME = 'cs trades.xlsx';

export function DataPanel({ feeRate, onChange }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';

  const run = async (busyText: string, task: () => Promise<string>) => {
    setStatus({ kind: 'busy', text: busyText });
    try {
      setStatus({ kind: 'done', text: await task() });
      onChange();
    } catch (cause) {
      setStatus({ kind: 'error', text: errorMessage(cause) });
    }
  };

  const describeImport = ({ added, total }: ImportSummary) =>
    added === 0 ? `Up to date. All ${total} trades were already in Flipbook.` : `Added ${added} new trades (${total} read).`;

  const sync = () => run('Syncing with CSFloat…', async () => describeImport(await syncFromCsfloat()));

  const onFile = (importer: (file: File) => Promise<ImportSummary>) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void run(`Reading ${file.name}…`, async () => describeImport(await importer(file)));
  };

  const download = () =>
    run('Building spreadsheet…', async () => {
      const url = URL.createObjectURL(await exportWorkbook());
      Object.assign(document.createElement('a'), { href: url, download: EXPORT_FILE_NAME }).click();
      URL.revokeObjectURL(url);
      return `Downloaded ${EXPORT_FILE_NAME}.`;
    });

  const onFeeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const percent = Number(event.target.value);
    if (Number.isFinite(percent) && percent >= 0) void updateFeeRate(percent / PERCENT).then(onChange);
  };

  return (
    <section className="data">
      <Row title="Sync with CSFloat" hint="Pulls your full trade history through the CSFloat tab you're logged in to. Flipbook never sees your password or an API key.">
        <button className="button button-primary" disabled={busy} onClick={sync}>Sync trades</button>
      </Row>

      <Row title="Import trades.json" hint="For offline use: the file CSFloat returns from its trades page.">
        <FilePicker label="Choose file" accept=".json,application/json" disabled={busy} onChange={onFile(importTradesJson)} />
      </Row>

      <Row title="Import your spreadsheet" hint="Brings in flips from your Flips sheet that happened outside CSFloat. Sync first so rows link to real trades.">
        <FilePicker label="Choose .xlsx" accept=".xlsx" disabled={busy} onChange={onFile(importTrackerWorkbook)} />
      </Row>

      <Row title="Export spreadsheet" hint="Your Flips sheet layout with live formulas, ready to keep using in Excel.">
        <button className="button" disabled={busy} onClick={download}>Download .xlsx</button>
      </Row>

      <Row title="Seller fee" hint="Taken off every sale. CSFloat charges 2% today; its terms allow up to 5%.">
        <label className="fee">
          <input type="number" min={0} max={50} step={0.1} defaultValue={feeRate * PERCENT} onBlur={onFeeChange} aria-label="Seller fee in percent" />
          <span>%</span>
        </label>
      </Row>

      {status.kind !== 'idle' && (
        <p className={`notice notice-${status.kind}`} role="status">{status.text}</p>
      )}
    </section>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="data-row">
      <div>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      <div className="data-action">{children}</div>
    </div>
  );
}

interface FilePickerProps {
  label: string;
  accept: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function FilePicker({ label, accept, disabled, onChange }: FilePickerProps) {
  return (
    <label className={`button ${disabled ? 'is-disabled' : ''}`}>
      {label}
      <input type="file" className="visually-hidden" accept={accept} disabled={disabled} onChange={onChange} />
    </label>
  );
}
