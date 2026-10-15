import { useEffect, useState } from 'react';

const STORAGE_KEY = 'flipbook:last-visit';

/**
 * When the user last opened Flipbook, so trades since then can be marked new.
 * Undefined on a first visit (nothing is new) or when storage is unavailable.
 */
export function useLastVisit(): string | undefined {
  const [previous] = useState(readLastVisit);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Without storage every visit is a first visit; nothing gets a NEW tag.
    }
  }, []);

  return previous;
}

function readLastVisit(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
