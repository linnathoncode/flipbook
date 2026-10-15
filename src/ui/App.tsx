import { useState } from 'react';
import { FlipsTable } from './components/FlipsTable';
import { ImportPanel } from './components/ImportPanel';
import { OpenPositionsTable } from './components/OpenPositionsTable';
import { ReviewPanel } from './components/ReviewPanel';
import { SummaryBar } from './components/SummaryBar';
import { useJournal } from './useJournal';

const TABS = ['Flips', 'Open', 'Review', 'Import'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const { journal, error, refresh } = useJournal();
  const [tab, setTab] = useState<Tab>('Flips');

  if (error) return <main className="page"><p className="error">{error}</p></main>;
  if (!journal) return <main className="page"><p className="muted">Loading…</p></main>;

  const { view, settings } = journal;
  const tabCount: Record<Tab, number | undefined> = {
    Flips: view.flips.length,
    Open: view.openBuys.length,
    Review: view.unmatchedSells.length,
    Import: undefined,
  };

  return (
    <main className="page">
      <header className="header">
        <h1>Trade Journal</h1>
        <SummaryBar summary={view.summary} lastSyncAt={settings.lastSyncAt} />
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
            {name}
            {tabCount[name] !== undefined && <span className="count">{tabCount[name]}</span>}
          </button>
        ))}
      </nav>

      {tab === 'Flips' && <FlipsTable flips={view.flips} onChange={refresh} />}
      {tab === 'Open' && <OpenPositionsTable buys={view.openBuys} />}
      {tab === 'Review' && <ReviewPanel unmatched={view.unmatchedSells} onChange={refresh} />}
      {tab === 'Import' && <ImportPanel feeRate={settings.feeRate} onChange={refresh} />}
    </main>
  );
}
