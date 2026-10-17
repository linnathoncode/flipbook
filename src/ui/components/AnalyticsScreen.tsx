import { analyze, ANALYTICS_PERIODS, type AnalyticsPeriod } from '../../domain/analytics';
import type { Section } from '../../domain/folders';
import { heldDays, type Flip } from '../../domain/profit';
import { formatDate, formatMoney, formatPercent, formatSignedMoney, plural } from '../format';
import { usePreference } from '../usePreference';
import { CumulativeChart, KindBars, MonthChart } from './charts';
import { itemTitle, Kpi, signClass } from './shared';
import { TitleBar, type SyncProps } from './TitleBar';

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = { '30d': '30 days', '90d': '90 days', all: 'All' };

interface Props {
  /** The Flips sheet. Folders hold what isn't a flip, so they're left out. */
  book: Section;
  feeRate: number;
  sync: SyncProps;
}

export function AnalyticsScreen({ book, feeRate, sync }: Props) {
  const [period, setPeriod] = usePreference<AnalyticsPeriod>('analytics-period', '90d');
  const data = analyze(book.flips, book.openBuys, period, new Date());
  const closed = data.closed.length;

  return (
    <>
      <header className="top">
        <TitleBar title="Analytics" {...sync}>
          <div className="seg" role="group" aria-label="Period">
            {ANALYTICS_PERIODS.map((option) => (
              <button key={option} aria-pressed={period === option} onClick={() => setPeriod(option)}>{PERIOD_LABEL[option]}</button>
            ))}
          </div>
        </TitleBar>
        <div className="kpis">
          <Kpi label="Net profit" value={formatSignedMoney(data.net)} sign={closed ? data.net : undefined} />
          <Kpi label="Flips closed" value={closed} />
          <Kpi label="Win rate" value={data.winRate === undefined ? '0%' : `${Math.round(data.winRate * 100)}%`} />
          <Kpi label="Avg profit" value={formatPercent(data.averagePercent ?? 0)} sign={data.averagePercent} />
          <Kpi label="Avg hold" value={plural(Math.round(data.averageHeldDays ?? 0), 'day')} />
          <Kpi label="Tied up in open buys" value={formatMoney(data.openCost)} />
        </div>
      </header>
      <div className="page">
        {closed === 0 ? (
          <div className="card">
            <h2>No closed flips in this period</h2>
            <p className="note flush">Pick a longer period above.</p>
          </div>
        ) : (
          <div className="agrid">
            <div className="card span2">
              <h2>Net profit over time</h2>
              <p className="note">Running total of closed flips after the {+(feeRate * 100).toFixed(2)}% seller fee.</p>
              <CumulativeChart data={data} />
            </div>
            <div className="card">
              <h2>By month</h2>
              <p className="note">Counted by the month you sold.</p>
              <MonthChart data={data} />
            </div>
            <div className="card">
              <h2>By item type</h2>
              <p className="note">Net profit per type.</p>
              <KindBars data={data} />
            </div>
            <div className="card">
              <h2>Best flips</h2>
              <FlipList flips={data.best} empty="No winning flips in this period." />
            </div>
            <div className="card">
              <h2>Worst flips</h2>
              <FlipList flips={data.worst} empty="No losing flips in this period." />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FlipList({ flips, empty }: { flips: Flip[]; empty: string }) {
  if (flips.length === 0) return <p className="note flush">{empty}</p>;
  return (
    <ol className="flist">
      {flips.map((flip) => {
        const title = itemTitle(flip.sell.item, flip.sell.source);
        const held = heldDays(flip);
        return (
          <li key={flip.sell.id}>
            <span className="nm">{title.detail ? `${title.name} (${title.detail})` : title.name}</span>
            <span className={`n pl ${signClass(flip.netProfit)}`}>{formatSignedMoney(flip.netProfit)}</span>
            <span className="s">{held === undefined ? '' : `Held ${plural(held, 'day')}, `}sold {formatDate(flip.sell.at)}</span>
            <span className="s n">{formatPercent(flip.profitPercent)}</span>
          </li>
        );
      })}
    </ol>
  );
}
