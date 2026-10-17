import type { ChangeEvent, ReactNode } from 'react';
import { removeRule, setOrphansToOther, updateFeeRate } from '../../app/actions';
import type { Folder, FolderRule } from '../../domain/folders';
import { KIND_PLURAL } from '../../domain/itemKinds';
import { formatDate } from '../format';
import { TitleBar, type SyncProps } from './TitleBar';

const PERCENT = 100;

interface Props {
  feeRate: number;
  rules: FolderRule[];
  orphansToOther: boolean;
  listingsError?: string;
  folders: Folder[];
  sync: SyncProps;
  onChange: () => void;
}

export function SettingsPanel({ feeRate, rules, orphansToOther, listingsError, folders, sync, onChange }: Props) {
  const onFeeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const percent = Number(event.target.value);
    if (Number.isFinite(percent) && percent >= 0) void updateFeeRate(percent / PERCENT).then(onChange);
  };
  const folderName = (id: string) => folders.find((folder) => folder.id === id)?.name ?? 'a deleted folder';

  return (
    <>
      <header className="top">
        <TitleBar title="Settings" {...sync} />
      </header>
      <div className="page settings">
        <Row
          title="Sync with CSFloat"
          hint="Happens on its own whenever a CSFloat tab loads, every 30 minutes while one is open, and when you open Flipbook. It reads your history through the tab you're logged in to. Flipbook never sees your password or an API key."
        >
          <button className="btn" onClick={sync.onSync}>Sync now</button>
        </Row>
        {listingsError && (
          <Row title="Listings" hint={`Your trades synced, but Flipbook could not read what you have listed, so the Listed tags may be out of date. CSFloat said: ${listingsError}`}>
            <span className="hint">Tries again on the next sync.</span>
          </Row>
        )}
        <Row title="Seller fee" hint="Taken off every sale. CSFloat charges 2% today; its terms allow up to 5%.">
          <label className="fee">
            <input className="search" type="number" min={0} max={50} step={0.1} defaultValue={+(feeRate * PERCENT).toFixed(2)} onBlur={onFeeChange} aria-label="Seller fee in percent" />
            <span>%</span>
          </label>
        </Row>
        <Row
          title="Sales with no buy on record"
          hint="Things you got outside CSFloat or before your history starts. Putting them in Other keeps them out of your flip totals."
        >
          <label className="check">
            <input type="checkbox" checked={orphansToOther} onChange={(event) => void setOrphansToOther(event.target.checked).then(onChange)} />
            Put them in Other
          </label>
        </Row>
        <Row
          title="Folder rules"
          hint="After you move items of one type into a folder, Flipbook offers to send new buys of that type there too. Items already on your sheets stay where they are."
        >
          {rules.length === 0 ? (
            <span className="hint">No rules yet.</span>
          ) : (
            <ul className="rules">
              {rules.map((rule) => (
                <li key={rule.kind}>
                  <span>
                    New {KIND_PLURAL[rule.kind].toLowerCase()} go to {folderName(rule.folderId)}
                    <span className="hint"> since {formatDate(rule.since)}</span>
                  </span>
                  <button className="btn ghost" onClick={() => void removeRule(rule.kind).then(onChange)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row title="Version" hint="Updates from the Chrome Web Store install on their own and keep your journal.">
          <span className="count">{__APP_VERSION__}</span>
        </Row>
      </div>
    </>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="settings-row">
      <div>
        <h2>{title}</h2>
        <p className="note flush">{hint}</p>
      </div>
      <div className="settings-action">{children}</div>
    </section>
  );
}
