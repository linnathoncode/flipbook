import { useCallback, useState } from 'react';

const KEY_PREFIX = 'flipbook:';

/**
 * A view setting remembered between visits (view mode, sort).
 * Storage can be unavailable; the setting then just lasts for the session.
 */
export function usePreference<T>(name: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => read(name, fallback));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(KEY_PREFIX + name, JSON.stringify(next));
      } catch {
        // Not persisted; the in-memory value still applies.
      }
    },
    [name],
  );
  return [value, update];
}

function read<T>(name: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(KEY_PREFIX + name);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}
