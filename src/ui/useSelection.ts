import { useCallback, useRef, useState } from 'react';

/** A selectable row: its key, and the trades that move when it moves. */
export interface Entry {
  key: string;
  tradeIds: string[];
}

export interface Selection {
  count: number;
  has: (key: string) => boolean;
  /** Shift-click selects everything between the last clicked row and this one. */
  toggle: (entry: Entry, extendRange: boolean, visible: Entry[]) => void;
  setAll: (entries: Entry[], selected: boolean) => void;
  tradeIds: () => string[];
  clear: () => void;
}

export function useSelection(): Selection {
  const [selected, setSelected] = useState<ReadonlyMap<string, string[]>>(new Map());
  const anchor = useRef<string>();

  const toggle = useCallback((entry: Entry, extendRange: boolean, visible: Entry[]) => {
    // Read the anchor now: the updater below runs later, after it has moved to this row.
    const previousAnchor = anchor.current;
    setSelected((current) => {
      const next = new Map(current);
      const anchorIndex = visible.findIndex((candidate) => candidate.key === previousAnchor);
      const index = visible.findIndex((candidate) => candidate.key === entry.key);
      if (extendRange && anchorIndex !== -1 && index !== -1) {
        const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
        visible.slice(from, to + 1).forEach((inRange) => next.set(inRange.key, inRange.tradeIds));
      } else if (next.has(entry.key)) {
        next.delete(entry.key);
      } else {
        next.set(entry.key, entry.tradeIds);
      }
      return next;
    });
    anchor.current = entry.key;
  }, []);

  const setAll = useCallback((entries: Entry[], value: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      entries.forEach((entry) => (value ? next.set(entry.key, entry.tradeIds) : next.delete(entry.key)));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Map());
    anchor.current = undefined;
  }, []);

  return {
    count: selected.size,
    has: (key) => selected.has(key),
    toggle,
    setAll,
    tradeIds: () => [...selected.values()].flat(),
    clear,
  };
}
