import type { ReactNode } from 'react';
import type { Sort, SortKey } from '../../domain/listFilters';
import type { Item, MatchConfidence, TradeSource } from '../../domain/types';
import { roundTo } from '../format';

const WEAR_CODES: Record<string, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

export const CONFIDENCE: Record<MatchConfidence, { label: string; hint: string }> = {
  exact: { label: 'Exact', hint: 'Same float, seed and pattern' },
  fifo: { label: 'FIFO', hint: 'Interchangeable item, oldest buy closed first' },
  suggested: { label: 'Check', hint: 'Paired by name only. One earlier buy matched, so check it.' },
  tracker: { label: 'Tracker', hint: 'Paired on a row of your spreadsheet' },
  manual: { label: 'Manual', hint: 'You chose this pairing' },
};

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** CSS class that colors a number by whether it's a gain or a loss. Break-even counts as a gain. */
export function signClass(value?: number): string {
  if (value === undefined) return '';
  return roundTo(value, 2) >= 0 ? 'pos' : 'neg';
}

/** Whether a trade happened after `since`, e.g. the last visit. ISO strings compare in time order. */
export function isAfter(iso: string | undefined, since?: string): boolean {
  return iso !== undefined && since !== undefined && iso > since;
}

export interface ItemTitle {
  name: string;
  /** Wear code for skins, the event for stickers. */
  detail?: string;
  /** Full wear name for skins, event or type otherwise. */
  longDetail?: string;
}

/** Rows typed into a spreadsheet keep the name the user wrote. */
export function itemTitle(item: Item, source: TradeSource = 'csfloat'): ItemTitle {
  if (source === 'xlsx') return { name: item.itemName };
  const prefix = item.isStatTrak ? 'StatTrak™ ' : item.isSouvenir ? 'Souvenir ' : '';
  if (item.wearName) {
    return { name: prefix + item.itemName, detail: WEAR_CODES[item.wearName] ?? item.wearName, longDetail: item.wearName };
  }
  const split = item.itemName.lastIndexOf(' | ');
  if ((item.type === 'sticker' || item.type === 'patch') && split > 0) {
    const event = item.itemName.slice(split + 3);
    return { name: item.itemName.slice(0, split), detail: event, longDetail: event };
  }
  return { name: prefix + item.itemName, longDetail: typeLabel(item.type) };
}

function typeLabel(type: string): string | undefined {
  if (type === 'unknown') return undefined;
  const words = type.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (sort: Sort) => void;
  numeric?: boolean;
  title?: string;
}

/** Click to sort by this column; click again to flip it. Names start A to Z, everything else highest first. */
export function SortHeader({ label, sortKey, sort, onSort, numeric = false, title }: SortHeaderProps) {
  const active = sort.key === sortKey;
  return (
    <th className={numeric ? 'n' : undefined} aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined} title={title}>
      <button onClick={() => onSort({ key: sortKey, descending: active ? !sort.descending : sortKey !== 'name' })}>
        {label}
        {active && (sort.descending ? ' ↓' : ' ↑')}
      </button>
    </th>
  );
}

interface KpiProps {
  label: string;
  value: ReactNode;
  /** Colors the figure as a gain or loss. */
  sign?: number;
  sub?: ReactNode;
}

export function Kpi({ label, value, sign, sub }: KpiProps) {
  return (
    <div className="kpi">
      <span className="l">{label}</span>
      <span className={`v ${signClass(sign)}`}>{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}
