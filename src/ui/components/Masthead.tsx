import { useEffect, useState } from 'react';
import { formatTimeAgo } from '../format';
import type { SyncState } from '../useJournal';
import type { Theme } from '../useTheme';

const CLOCK_TICK_MS = 30 * 1000;

interface Props {
  lastSyncAt?: string;
  lastSyncError?: string;
  syncState: SyncState;
  onSync: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Masthead({ lastSyncAt, lastSyncError, syncState, onSync, theme, onToggleTheme }: Props) {
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <header className="masthead">
      <span className="wordmark">
        <Logo />
        Flipbook
      </span>
      <div className="masthead-actions">
        <SyncLabel lastSyncAt={lastSyncAt} lastSyncError={lastSyncError} syncState={syncState} />
        <button className="button" onClick={onSync} disabled={syncState.kind === 'syncing'}>
          Sync now
        </button>
        <button className="button icon-button" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}

function SyncLabel({ lastSyncAt, lastSyncError, syncState }: Pick<Props, 'lastSyncAt' | 'lastSyncError' | 'syncState'>) {
  const now = useNow(CLOCK_TICK_MS);
  if (syncState.kind === 'syncing') return <span className="sync-label">Syncing with CSFloat…</span>;

  const error = syncState.kind === 'failed' ? syncState.error : lastSyncError;
  if (error) return <span className="sync-label is-error" title={error}>Sync failed: {error}</span>;

  if (!lastSyncAt) return <span className="sync-label">Not synced with CSFloat yet</span>;
  return (
    <span className="sync-label" title="Flipbook syncs on its own whenever a CSFloat tab is open">
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

/** A red tile with its corner folded over, like a turned page in a ledger. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M0 0h15l9 9v15H0z" fill="var(--accent)" />
      <path d="M15 0v9h9z" fill="var(--ink)" />
      <path d="M7.5 7.5H13v3H9.5v2h3v3h-3v4H6V9z" fill="var(--on-accent)" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
