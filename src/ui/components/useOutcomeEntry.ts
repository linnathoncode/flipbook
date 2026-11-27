/** The one-time ASCII reveal that marks each closed trade's outcome as rows first appear. */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { SheetRow } from '../../domain/listFilters';
import { roundTo } from '../format';

export const ENTRY_STAGGER_MS = 155;
export const ENTRY_WINDOW_MS = 950;
export const ENTRY_MARKS = ['*+*', '+.+', '.*.', '.+.'];
export const ENTRY_GLYPH_HEIGHT = 8;

export function tradeOutcome(row: SheetRow) {
  const net = row.status === 'closed' ? roundTo(row.net ?? 0, 2) : 0;
  return net > 0 ? 'gain' : net < 0 ? 'loss' : undefined;
}

export function useOutcomeEntry(table: RefObject<HTMLTableElement>, rows: SheetRow[]) {
  const initialRows = useRef(rows);
  const [intro, setIntro] = useState<{
    visibleRows: { key: string; index: number }[];
    byKey: Map<string, { delay: number; lines: number }>;
    last: string;
  }>();
  useLayoutEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const element = table.current;
    const scrollport = element?.closest('.tablewrap');
    if (motion.matches || !element || !scrollport) return;

    const { top, bottom } = scrollport.getBoundingClientRect();
    const totalsTop = element.tFoot?.rows[0]?.cells[0]?.getBoundingClientRect().top ?? bottom;
    const visible = Math.min(totalsTop, bottom);
    const visibleRows = [...element.querySelectorAll('tbody > .row')].flatMap((element, index) => {
      const row = initialRows.current[index];
      const rect = element.getBoundingClientRect();
      return row && rect.top < visible && rect.bottom > top ? [{ row, index, height: rect.height }] : [];
    });
    const entries = visibleRows.filter(({ row }) => tradeOutcome(row));
    const last = entries.at(-1)?.row.key;
    if (!last) return;

    const stagger = Math.min(ENTRY_STAGGER_MS, Math.floor(ENTRY_WINDOW_MS / Math.max(1, entries.length - 1)));
    setIntro({
      visibleRows: visibleRows.map(({ row, index }) => ({ key: row.key, index })),
      byKey: new Map(entries.map(({ row, height }, index) => [
        row.key,
        { delay: index * stagger, lines: Math.max(3, Math.floor((height - 4) / ENTRY_GLYPH_HEIGHT)) },
      ])),
      last,
    });

    const handleMotion = () => { if (motion.matches) setIntro(undefined); };
    motion.addEventListener('change', handleMotion);
    return () => motion.removeEventListener('change', handleMotion);
  }, [table]);

  const current = intro?.visibleRows.every(({ key, index }) => rows[index]?.key === key) ? intro : undefined;
  useEffect(() => {
    if (intro && !current) setIntro(undefined);
  }, [intro, current]);

  return { entry: current, finish: () => setIntro(undefined) };
}
