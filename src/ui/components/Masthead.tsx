import { useEffect, useState } from 'react';
import { formatTimeAgo } from '../format';
import type { SyncState } from '../useJournal';

const CLOCK_TICK_MS = 30 * 1000;

interface Props {
  lastSyncAt?: string;
  lastSyncError?: string;
  syncState: SyncState;
  onSync: () => void;
}

export function Masthead({ lastSyncAt, lastSyncError, syncState, onSync }: Props) {
  return (
    <header className="masthead">
      <span className="wordmark">
        <Logo />
        Flipbook
      </span>
      <div className="sync">
        <SyncLabel lastSyncAt={lastSyncAt} lastSyncError={lastSyncError} syncState={syncState} />
        <button className="button button-small" onClick={onSync} disabled={syncState.kind === 'syncing'}>
          Sync now
        </button>
      </div>
    </header>
  );
}

function SyncLabel({ lastSyncAt, lastSyncError, syncState }: Omit<Props, 'onSync'>) {
  const now = useNow(CLOCK_TICK_MS);
  if (syncState.kind === 'syncing') return <span className="sync-label is-busy">Syncing with CSFloat…</span>;

  const error = syncState.kind === 'failed' ? syncState.error : lastSyncError;
  if (error) return <span className="sync-label is-error" title={error}>Sync failed: {error}</span>;

  if (!lastSyncAt) return <span className="sync-label">Not synced with CSFloat yet</span>;
  return (
    <span className="sync-label" title="Flipbook syncs on its own whenever a CSFloat tab is open">
      <span className="sync-dot" aria-hidden="true" />
      Synced {formatTimeAgo(lastSyncAt, now)}
    </span>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** A brass tile with its corner folded over: the same fold that splits bought from sold in the ledger. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 0h10l9 9v10a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5z" fill="var(--brass)" />
      <path d="M15 0v9h9z" fill="var(--bone)" />
      <path d="M7.5 7.5H13v3H9.5v2h3v3h-3v4H6V9z" fill="var(--slate)" />
    </svg>
  );
}
