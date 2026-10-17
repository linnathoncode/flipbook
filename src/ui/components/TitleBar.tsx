import { useEffect, useState, type ReactNode } from 'react';
import { formatTimeAgo } from '../format';
import type { PricingProgress } from '../../app/sync';
import type { SyncState } from '../useJournal';
import type { Theme } from '../useTheme';

const CLOCK_TICK_MS = 30 * 1000;

export interface SyncProps {
  lastSyncAt?: string;
  lastSyncError?: string;
  syncState: SyncState;
  onSync: () => void;
  /** Syncs and re-prices held items now. */
  onRefreshPrices: () => void;
  /** CSFloat asked for a break from price requests until then. */
  pricesPausedUntil?: string;
  /** Set while held items are being priced. */
  pricing?: PricingProgress;
  theme: Theme;
  onToggleTheme: () => void;
}

interface Props extends SyncProps {
  title: string;
  /** Sits right after the title, e.g. a folder's Rename button or a period switch. */
  children?: ReactNode;
}

/** Page title on the left; sync status, Sync now and the theme switch on the right. */
export function TitleBar({ title, children, onSync, syncState, theme, onToggleTheme, ...status }: Props) {
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <div className="titlebar">
      <h1>{title}</h1>
      {children}
      <SyncLabel syncState={syncState} {...status} />
      <button className="btn" onClick={onSync} disabled={syncState.kind === 'syncing'}>Sync now</button>
      <button className="btn sq ghost" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}

function SyncLabel({ lastSyncAt, lastSyncError, syncState }: Pick<SyncProps, 'lastSyncAt' | 'lastSyncError' | 'syncState'>) {
  const now = useNow(CLOCK_TICK_MS);
  if (syncState.kind === 'syncing') return <span className="sync">Syncing with CSFloat…</span>;

  const error = syncState.kind === 'failed' ? syncState.error : lastSyncError;
  if (error) return <span className="sync err" title={error}>Sync failed: {error}</span>;

  if (!lastSyncAt) return <span className="sync">Not synced with CSFloat yet</span>;
  return (
    <span className="sync" title="Flipbook syncs on its own whenever a CSFloat tab is open">
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

const iconProps = {
  viewBox: '0 0 24 24',
  width: 15,
  height: 15,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function SunIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}
