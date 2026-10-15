import { useCallback, useRef, useState } from 'react';

/** A selectable row: its key, and the trades that move when it moves. */
export interface Entry {
  key: string;
  tradeIds: string[];
}

/** Ctrl/Cmd adds to the selection; Shift selects from the last clicked row. Same as a spreadsheet. */
export interface Modifiers {
  add: boolean;
  range: boolean;
}

export interface Selection {
  count: number;
  has: (key: string) => boolean;
  /** `visible` is the rows on screen, in order, so a range covers what the user sees. */
  click: (entry: Entry, modifiers: Modifiers, visible: Entry[]) => void;
  setAll: (entries: Entry[], selected: boolean) => void;
  tradeIds: () => string[];
  clear: () => void;
}

export function useSelection(): Selection {
  const [selected, setSelected] = useState<ReadonlyMap<string, string[]>>(new Map());
  const anchor = useRef<string>();

  const click = useCallback((entry: Entry, { add, range }: Modifiers, visible: Entry[]) => {
    const anchorIndex = visible.findIndex((candidate) => candidate.key === anchor.current);
    const index = visible.findIndex((candidate) => candidate.key === entry.key);

    if (range && anchorIndex !== -1 && index !== -1) {
      // The anchor stays put, so a second shift-click resizes the range instead of chaining it.
      const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
      setSelected((current) => {
        const next = new Map(add ? current : []);
        visible.slice(from, to + 1).forEach((inRange) => next.set(inRange.key, inRange.tradeIds));
        return next;
      });
      return;
    }

    anchor.current = entry.key;
    setSelected((current) => {
      if (!add) return new Map([[entry.key, entry.tradeIds]]);
      const next = new Map(current);
      if (next.has(entry.key)) next.delete(entry.key);
      else next.set(entry.key, entry.tradeIds);
      return next;
    });
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
    click,
    setAll,
    tradeIds: () => [...selected.values()].flat(),
    clear,
  };
}
