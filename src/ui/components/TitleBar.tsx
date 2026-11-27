import { useEffect, useState, type ReactNode } from 'react';
import { formatTimeAgo } from '../format';
import type { PricingProgress } from '../../app/sync';
import type { SyncState } from '../useJournal';
import type { Theme } from '../useTheme';
import { Icon } from './Icon';
import { Signal } from './Signal';

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
  /** Set while a single row is being priced; blocks a held-items batch from starting alongside it. */
  rowPricing: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

interface Props extends SyncProps {
  title: string;
  /** Sits right after the title, e.g. a folder's Rename button or a period switch. */
  children?: ReactNode;
}

/** Page title on the left; sync status, Sync now and the theme switch on the right. */
export function TitleBar({ title, children, onSync, syncState, rowPricing, theme, onToggleTheme, ...status }: Props) {
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <div className="titlebar">
      <h1>{title}</h1>
      {children}
      <div className="title-actions">
        <SyncLabel syncState={syncState} {...status} />
        <button className="btn pri" onClick={onSync} disabled={syncState.kind === 'syncing' || rowPricing}>Sync now</button>
        <button className="btn sq ghost" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
          <span key={theme} className="theme-glyph"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></span>
        </button>
      </div>
    </div>
  );
}

function SyncLabel({ lastSyncAt, lastSyncError, syncState }: Pick<SyncProps, 'lastSyncAt' | 'lastSyncError' | 'syncState'>) {
  const now = useNow(CLOCK_TICK_MS);
  if (syncState.kind === 'syncing') return <span className="sync has-signal" role="status"><Signal /> Syncing with CSFloat</span>;

  const error = syncState.kind === 'failed' ? syncState.error : lastSyncError;
  if (error) return <span className="sync err" title={error} role="status">Sync failed: {error}</span>;

  if (!lastSyncAt) return <span className="sync">Not synced with CSFloat yet</span>;
  return (
    <span className="sync" title="flipbook syncs on its own whenever a CSFloat tab is open">
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
