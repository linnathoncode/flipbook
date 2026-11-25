import { useLayoutEffect, useRef } from 'react';
import type { Journal } from '../../app/actions';
import { analyze, ANALYTICS_PERIODS, type Analytics, type AnalyticsPeriod } from '../../domain/analytics';
import { HOLDS_ID, OTHER_ID } from '../../domain/folders';
import { sectionRows, totalRows } from '../../domain/listFilters';
import { centsToDollars, heldDays, type Flip } from '../../domain/profit';
import { formatDate, formatMoney, formatMonth, formatPercent, formatSignedMoney, plural } from '../format';
import { usePreference } from '../usePreference';
import { CumulativeChart, KindBars, MonthChart, NetBars } from './charts';
import { itemTitle, Kpi, signClass } from './shared';
import { TitleBar, type SyncProps } from './TitleBar';

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = { '30d': '30 days', '90d': '90 days', all: 'All' };

export interface AnalyticsDrilldown {
  label: string;
  period: string;
  sellIds: ReadonlySet<string>;
  position: AnalyticsPosition;
  inspectSellId?: string;
}

export interface AnalyticsPosition {
  scrollTop: number;
  controlId: string;
}

interface Props {
  journal: Journal;
  sync: SyncProps;
  onOpenTrades: (drilldown: AnalyticsDrilldown) => void;
  returnTo?: AnalyticsPosition;
}

export function AnalyticsScreen({ journal, sync, onOpenTrades, returnTo }: Props) {
  const page = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!returnTo || !page.current) return;
    const control = document.getElementById(returnTo.controlId) as HTMLElement | SVGElement | null;
    page.current.scrollTop = control ? returnTo.scrollTop : 0;
    (control ?? heading.current)?.focus({ preventScroll: true });
  }, [returnTo]);
  const [period, setPeriod] = usePreference<AnalyticsPeriod>('analytics-period', '90d');
  const { book } = journal.shelved;
  const now = new Date();
  const data = analyze(book.flips, book.openBuys, period, now);
  const closed = data.closed.length;
  const openGroup = (label: string, sellIds: string[], controlId: string, inspectSellId?: string) => onOpenTrades({
    label,
    period: period === 'all' ? 'All time' : `Last ${PERIOD_LABEL[period]}`,
    sellIds: new Set(sellIds),
    position: { scrollTop: page.current?.scrollTop ?? 0, controlId },
    inspectSellId,
  });
  const openFlip = (flip: Flip, controlId: string) => openGroup(itemTitle(flip.sell.item, flip.sell.source).name, [flip.sell.id], controlId, flip.sell.id);

  return (
    <>
      <header className="top">
        <TitleBar title="Analytics" {...sync}>
          <div className="seg" role="group" aria-label="Sale period">
            {ANALYTICS_PERIODS.map((option) => (
              <button key={option} aria-pressed={period === option} onClick={() => setPeriod(option)}>{PERIOD_LABEL[option]}</button>
            ))}
          </div>
        </TitleBar>
        <div className="kpis analytics-kpis">
          <Kpi label="Net profit" value={closed ? formatSignedMoney(data.net) : '\u2014'} sign={closed ? data.net : undefined} />
          <Kpi label="Weighted return" value={data.weightedReturn === undefined ? '\u2014' : formatPercent(data.weightedReturn)} sign={data.weightedReturn} sub="On closed buy cost" />
          <Kpi label="Closed trades" value={closed} />
          <Kpi label="Win rate" value={data.winRate === undefined ? '\u2014' : `${Math.round(data.winRate * 100)}%`} />
          <Kpi label="Median hold" value={data.medianHeldDays === undefined ? '\u2014' : plural(data.medianHeldDays, 'day')} />
        </div>
      </header>
      <div className="page analytics-page" ref={page}>
        {closed === 0 ? (
          <section className="card">
            <h2 ref={heading} tabIndex={-1}>No dated sales in this period</h2>
            <p className="note flush">Pick a longer period. Period results use recorded sale dates.</p>
          </section>
        ) : (
          <div className="analytics-grid">
            <section className="card">
              <h2 ref={heading} tabIndex={-1}>Net profit over time</h2>
              <p className="note">Dated sales on the Flips sheet, after fees.</p>
              <CumulativeChart data={data} />
            </section>
            <OutcomeSummary data={data} />
            <section className="card">
              <h2>By month</h2>
              <p className="note">Select a month to view its trades.</p>
              <MonthChart data={data} onOpen={({ month, sellIds }, id) => openGroup(`${formatMonth(month)} ${month.slice(0, 4)}`, sellIds, id)} />
            </section>
            <section className="card">
              <h2>By item type</h2>
              <p className="note">Select an item type to view its trades.</p>
              <KindBars data={data} onOpen={openGroup} />
            </section>
            <section className="card">
              <h2>Best flips</h2>
              <FlipList group="best" flips={data.best} empty="No profitable flips in this period." onOpen={openFlip} />
            </section>
            <section className="card">
              <h2>Biggest flops</h2>
              <FlipList group="worst" flips={data.worst} empty="No flops in this period." onOpen={openFlip} />
            </section>
            <section className="card span2">
              <h2>By holding time</h2>
              <p className="note">Select a holding period to view its trades.</p>
              <NetBars group="hold" rows={data.byHold} onOpen={(label, sellIds, id) => openGroup(`Held ${label}`, sellIds, id)} />
            </section>
          </div>
        )}
        <InventorySummary journal={journal} openCost={data.openCost} now={now} />
      </div>
    </>
  );
}

function OutcomeSummary({ data }: { data: Analytics }) {
  const { profitable, flops, even, gains, losses } = data.outcomes;
  const closed = data.closed.length;
  return (
    <section className="card">
      <h2>Trade outcomes</h2>
      <div className="outcome-split" aria-hidden="true">
        {profitable > 0 && <i className="pos" style={{ flexGrow: profitable }} />}
        {even > 0 && <i style={{ flexGrow: even }} />}
        {flops > 0 && <i className="neg" style={{ flexGrow: flops }} />}
      </div>
      <dl className="analytics-values">
        <Metric label={plural(profitable, 'profitable flip')} value={formatSignedMoney(gains)} sign={profitable ? gains : undefined} />
        <Metric label={plural(flops, 'flop')} value={formatSignedMoney(losses)} sign={flops ? losses : undefined} />
        {even > 0 && <Metric label="Break-even trades" value={String(even)} />}
        <Metric label="Sale proceeds" value={formatMoney(data.proceeds)} />
        <Metric label="Closed buy cost" value={formatMoney(data.closedCost)} />
        <Metric label="Fees" value={formatMoney(data.fees)} />
      </dl>
      {profitable > 3 && data.topThreeGainShare !== undefined && (
        <p className="note flush">The top 3 of {closed} closed trades account for {Math.round(data.topThreeGainShare * 100)}% of all gains.</p>
      )}
    </section>
  );
}

function InventorySummary({ journal, openCost, now }: { journal: Journal; openCost: number; now: Date }) {
  const { book, folders } = journal.shelved;
  const heldSection = folders.get(HOLDS_ID);
  const holds = heldSection ? sectionRows(heldSection, journal.settings.feeRate, now, { prices: journal.prices }).filter((row) => row.status === 'open') : [];
  const priced = holds.filter((row) => row.quote !== undefined).length;
  const holdTotals = totalRows(holds);
  const other = folders.get(OTHER_ID);
  const otherSales = other?.sales ?? [];
  const otherGross = otherSales.reduce((sum, { sell }) => sum + centsToDollars(sell.priceCents), 0);

  return (
    <section className="card">
      <h2>Inventory and other sales</h2>
      <p className="note">Current snapshot across your journal.</p>
      <div className="analytics-inventory">
        <div>
          <h3>Open flips</h3>
          <dl className="analytics-values">
            <Metric label="Open buys" value={String(book.openBuys.length)} />
            <Metric label="Open buy cost" value={formatMoney(openCost)} />
          </dl>
        </div>
        <div>
          <h3>Holds</h3>
          <dl className="analytics-values">
            <Metric label="Held items" value={String(holds.length)} />
            <Metric label="Total buy cost" value={formatMoney(holdTotals.buy ?? 0)} />
            {priced > 0 && priced < holds.length && <Metric label="Buy cost of priced items" value={formatMoney(holdTotals.pricedBuy)} />}
            <Metric label="Market value" value={formatMoney(holdTotals.nowPrice) || '\u2014'} />
            <Metric label="Profit if sold" value={holdTotals.nowNet === undefined ? '\u2014' : formatSignedMoney(holdTotals.nowNet)} sign={holdTotals.nowNet} />
          </dl>
          {holds.length > 0 && <p className="note flush">Estimates cover {priced} of {holds.length} held items with saved prices.</p>}
        </div>
        <div>
          <h3>Other</h3>
          <dl className="analytics-values">
            <Metric label="Open buys" value={String(other?.openBuys.length ?? 0)} />
            <Metric label="Paired sales" value={String(other?.flips.length ?? 0)} />
            <Metric label="Unpaired sales" value={String(otherSales.length)} />
            <Metric label="Gross unpaired sales" value={formatMoney(otherGross)} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, sign }: { label: string; value: string; sign?: number }) {
  return <div><dt>{label}</dt><dd className={`pl ${signClass(sign)}`}>{value}</dd></div>;
}

function FlipList({ group, flips, empty, onOpen }: {
  group: 'best' | 'worst'; flips: Flip[]; empty: string; onOpen: (flip: Flip, controlId: string) => void;
}) {
  if (flips.length === 0) return <p className="note flush">{empty}</p>;
  return (
    <ol className="flist">
      {flips.map((flip) => {
        const title = itemTitle(flip.sell.item, flip.sell.source);
        const held = heldDays(flip);
        return (
          <li key={flip.sell.id}>
            <button id={`analytics-${group}-${flip.sell.id}`} className="analytics-row-link" onClick={(event) => onOpen(flip, event.currentTarget.id)}>
              <span className="nm">{title.detail ? `${title.name} (${title.detail})` : title.name} <span aria-hidden="true">›</span></span>
              <span className={`n pl ${signClass(flip.netProfit)}`}>{formatSignedMoney(flip.netProfit)}</span>
              <span className="s">{held === undefined ? '' : `Held ${plural(held, 'day')}, `}sold {formatDate(flip.sell.at)}</span>
              <span className="s n">{formatPercent(flip.profitPercent)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
