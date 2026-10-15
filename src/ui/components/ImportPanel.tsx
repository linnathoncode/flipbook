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

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

const PERCENT = 100;

export function ImportPanel({ feeRate, onChange }: Props) {
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

  const describeImport = ({ added, total }: ImportSummary) => `${added} new of ${total} trades.`;

  const onFile = (importer: (file: File) => Promise<ImportSummary>) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void run(`Reading ${file.name}…`, async () => describeImport(await importer(file)));
  };

  const download = () =>
    run('Building workbook…', async () => {
      const url = URL.createObjectURL(await exportWorkbook());
      const link = Object.assign(document.createElement('a'), { href: url, download: 'cs trades.xlsx' });
      link.click();
      URL.revokeObjectURL(url);
      return 'Workbook downloaded.';
    });

  const onFeeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const percent = Number(event.target.value);
    if (Number.isFinite(percent) && percent >= 0) void updateFeeRate(percent / PERCENT).then(onChange);
  };

  return (
    <section className="import">
      <Step title="1. Sync from CSFloat" hint="Uses your logged-in CSFloat session. No API key needed.">
        <button className="primary" disabled={busy} onClick={() => run('Syncing…', async () => describeImport(await syncFromCsfloat()))}>
          Sync trades
        </button>
      </Step>

      <Step title="…or import trades.json" hint="The file CSFloat's /me/trades endpoint returns.">
        <input type="file" accept=".json,application/json" disabled={busy} onChange={onFile(importTradesJson)} />
      </Step>

      <Step title="2. Import your tracker (optional)" hint="Brings in rows bought or sold outside CSFloat. Import after syncing.">
        <input type="file" accept=".xlsx" disabled={busy} onChange={onFile(importTrackerWorkbook)} />
      </Step>

      <Step title="3. Export" hint="Same layout as your Flips sheet, with live formulas.">
        <button disabled={busy} onClick={download}>Download .xlsx</button>
      </Step>

      <Step title="Seller fee" hint="CSFloat charges 2% today; its terms allow up to 5%.">
        <label className="fee">
          <input type="number" min={0} max={50} step={0.1} defaultValue={feeRate * PERCENT} onBlur={onFeeChange} /> %
        </label>
      </Step>

      {status.kind !== 'idle' && <p className={`status ${status.kind}`}>{status.text}</p>}
    </section>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="step">
      <div>
        <h2>{title}</h2>
        <p className="muted small">{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
