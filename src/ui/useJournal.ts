import { useCallback, useEffect, useState } from 'react';
import { loadJournal } from '../app/actions';

type Journal = Awaited<ReturnType<typeof loadJournal>>;

export function useJournal() {
  const [journal, setJournal] = useState<Journal>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setJournal(await loadJournal());
      setError(undefined);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { journal, error, refresh };
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
