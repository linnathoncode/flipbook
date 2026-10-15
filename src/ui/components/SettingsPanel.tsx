import type { ChangeEvent, ReactNode } from 'react';
import { updateFeeRate } from '../../app/actions';

const PERCENT = 100;

interface Props {
  feeRate: number;
  onSync: () => void;
  onChange: () => void;
}

export function SettingsPanel({ feeRate, onSync, onChange }: Props) {
  const onFeeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const percent = Number(event.target.value);
    if (Number.isFinite(percent) && percent >= 0) void updateFeeRate(percent / PERCENT).then(onChange);
  };

  return (
    <section className="settings">
      <h1 className="page-title">Settings</h1>
      <Row
        title="Sync with CSFloat"
        hint="Happens on its own whenever a CSFloat tab loads, every 30 minutes while one is open, and when you open Flipbook. It reads your history through the tab you're logged in to. Flipbook never sees your password or an API key."
      >
        <button className="button" onClick={onSync}>Sync now</button>
      </Row>
      <Row title="Seller fee" hint="Taken off every sale. CSFloat charges 2% today; its terms allow up to 5%.">
        <label className="fee">
          <input type="number" min={0} max={50} step={0.1} defaultValue={feeRate * PERCENT} onBlur={onFeeChange} aria-label="Seller fee in percent" />
          <span>%</span>
        </label>
      </Row>
    </section>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      <div className="settings-action">{children}</div>
    </div>
  );
}
