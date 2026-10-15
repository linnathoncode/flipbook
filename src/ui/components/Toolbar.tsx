import { VIEW_MODE_LABEL, VIEW_MODES, type ViewMode } from '../places';
import { Segmented } from './FilterPanel';

interface Props {
  query: string;
  onQuery: (query: string) => void;
  shown: number;
  total: number;
  /** Singular; an "s" is added for any other count. */
  noun: string;
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
}

export function Toolbar({ query, onQuery, shown, total, noun, mode, onMode }: Props) {
  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search items"
        aria-label="Search items"
      />
      <span className="result-count" aria-live="polite">
        {shown === total ? total : `${shown} of ${total}`} {total === 1 ? noun : `${noun}s`}
      </span>
      <div className="view-switch" role="group" aria-label="Layout">
        <Segmented options={VIEW_MODES.map((value) => ({ value, label: VIEW_MODE_LABEL[value] }))} value={mode} onChange={onMode} />
      </div>
    </div>
  );
}
