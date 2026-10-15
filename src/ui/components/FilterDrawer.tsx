import type { ReactNode } from 'react';
import {
  EMPTY_FILTER,
  ITEM_KINDS,
  PERIODS,
  type ItemKind,
  type ListFilter,
  type Period,
  type ResultFilter,
} from '../../domain/listFilters';
import type { MatchConfidence } from '../../domain/types';

const KIND_LABEL: Record<ItemKind, string> = {
  skin: 'Skins',
  sticker: 'Stickers',
  case: 'Cases',
  agent: 'Agents',
  other: 'Other',
};

const PERIOD_LABEL: Record<Period, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': 'Year', all: 'All time' };
const RESULT_LABEL: Record<ResultFilter, string> = { all: 'All', profit: 'Profit', loss: 'Loss' };
const MATCH_OPTIONS: Option<MatchConfidence>[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'fifo', label: 'FIFO' },
  { value: 'suggested', label: 'Check' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'manual', label: 'Manual' },
];

/** How many filters are narrowing the list, search aside; shown on the Filters button. */
export function countActiveFilters(filter: ListFilter): number {
  return [filter.kinds.length > 0, filter.period !== 'all', filter.result !== 'all', filter.matches.length > 0].filter(Boolean).length;
}

interface Props {
  filter: ListFilter;
  onChange: (filter: ListFilter) => void;
  /** Holdings haven't been sold, so result and match filters don't apply to them. */
  showFlipFilters: boolean;
  periodLabel: string;
}

export function FilterDrawer({ filter, onChange, showFlipFilters, periodLabel }: Props) {
  const update = (patch: Partial<ListFilter>) => onChange({ ...filter, ...patch });

  return (
    <section id="filter-drawer" className="filter-drawer" aria-label="Filters">
      <FilterGroup label="Type">
        <Chips options={ITEM_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))} selected={filter.kinds} onChange={(kinds) => update({ kinds })} />
      </FilterGroup>

      <FilterGroup label={periodLabel}>
        <Segmented options={PERIODS.map((period) => ({ value: period, label: PERIOD_LABEL[period] }))} value={filter.period} onChange={(period) => update({ period })} />
      </FilterGroup>

      {showFlipFilters && (
        <>
          <FilterGroup label="Result">
            <Segmented
              options={(['all', 'profit', 'loss'] as const).map((result) => ({ value: result, label: RESULT_LABEL[result] }))}
              value={filter.result}
              onChange={(result) => update({ result })}
            />
          </FilterGroup>
          <FilterGroup label="Match">
            <Chips options={MATCH_OPTIONS} selected={filter.matches} onChange={(matches) => update({ matches })} />
          </FilterGroup>
        </>
      )}

      {countActiveFilters(filter) > 0 && (
        <button className="text-button filter-clear" onClick={() => onChange({ ...EMPTY_FILTER, query: filter.query })}>
          Clear filters
        </button>
      )}
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filter-group" role="group" aria-label={label}>
      <span className="filter-label">{label}</span>
      {children}
    </div>
  );
}

interface Option<T> {
  value: T;
  label: string;
}

/** Multi-select: nothing selected means no restriction. */
function Chips<T extends string>({ options, selected, onChange }: { options: Option<T>[]; selected: T[]; onChange: (next: T[]) => void }) {
  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return (
    <div className="chips">
      {options.map((option) => (
        <button key={option.value} className="chip" aria-pressed={selected.includes(option.value)} onClick={() => toggle(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="chips">
      {options.map((option) => (
        <button key={option.value} className="chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
