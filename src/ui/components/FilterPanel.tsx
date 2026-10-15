import {
  EMPTY_FILTER,
  isUnfiltered,
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

const PERIOD_LABEL: Record<Period, string> = { '7d': '7d', '30d': '30d', '90d': '90d', '1y': '1y', all: 'All' };
const RESULT_LABEL: Record<ResultFilter, string> = { all: 'All', profit: 'Profit', loss: 'Loss' };
const MATCH_OPTIONS: { value: MatchConfidence; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'fifo', label: 'FIFO' },
  { value: 'suggested', label: 'Check' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'manual', label: 'Manual' },
];

interface Props {
  filter: ListFilter;
  onChange: (filter: ListFilter) => void;
  /** Holdings haven't been sold, so result and match filters don't apply to them. */
  showFlipFilters: boolean;
  periodLabel: string;
}

export function FilterPanel({ filter, onChange, showFlipFilters, periodLabel }: Props) {
  const isFiltered = !isUnfiltered({ ...filter, query: '' });
  const update = (patch: Partial<ListFilter>) => onChange({ ...filter, ...patch });

  return (
    <section className="filters" aria-label="Filters">
      <div className="sidebar-title-row">
        <h2 className="sidebar-title">Filter</h2>
        {isFiltered && (
          <button className="text-button" onClick={() => onChange({ ...EMPTY_FILTER, query: filter.query })}>
            Clear
          </button>
        )}
      </div>

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
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
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

export function Segmented<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option.value} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
