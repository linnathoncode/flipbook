import { useCallback, useEffect, useRef, useState } from 'react';
import { loadJournal, type Journal } from '../app/actions';
import { onJournalUpdated, requestSync } from '../app/messages';
import { errorText, isSyncStale } from '../app/sync';

export type SyncState = { kind: 'idle' } | { kind: 'syncing' } | { kind: 'failed'; error: string };

/**
 * Loads the journal, reloads it when the background worker syncs,
 * and syncs once on open if the data is stale.
 */
export function useJournal() {
  const [journal, setJournal] = useState<Journal>();
  const [error, setError] = useState<string>();
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'idle' });
  const syncedOnOpen = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setJournal(await loadJournal());
      setError(undefined);
    } catch (cause) {
      setError(errorText(cause));
    }
  }, []);

  const run = useCallback(async (forcePrices: boolean) => {
    setSyncState({ kind: 'syncing' });
    try {
      await requestSync({ openTabIfNeeded: true, forcePrices });
      setSyncState({ kind: 'idle' });
    } catch (cause) {
      setSyncState({ kind: 'failed', error: errorText(cause) });
    }
    await refresh();
  }, [refresh]);

  const sync = useCallback(() => run(false), [run]);
  /** Syncs and re-prices held items even if their quotes haven't run out yet. */
  const refreshPrices = useCallback(() => run(true), [run]);

  useEffect(() => {
    void refresh();
    return onJournalUpdated(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    if (syncedOnOpen.current) return;
    syncedOnOpen.current = true;
    void isSyncStale().then((stale) => {
      if (stale) void sync();
    });
  }, [sync]);

  return { journal, error, refresh, sync, refreshPrices, syncState };
}
