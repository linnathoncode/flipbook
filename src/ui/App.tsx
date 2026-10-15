import { useState } from 'react';
import { DataPanel } from './components/DataPanel';
import { FlipsTable } from './components/FlipsTable';
import { OpenPositionsTable } from './components/OpenPositionsTable';
import { ReviewPanel } from './components/ReviewPanel';
import { SummaryBar } from './components/SummaryBar';
import { formatDate } from './format';
import { useJournal } from './useJournal';

const TABS = ['Flips', 'Holding', 'Needs review', 'Data'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const { journal, error, refresh } = useJournal();
  const [tab, setTab] = useState<Tab>('Flips');

  if (error) return <main className="page"><p className="notice notice-error">{error}</p></main>;
  if (!journal) return <main className="page" aria-busy="true" />;

  const { view, settings } = journal;
  const tabCount: Record<Tab, number | undefined> = {
    Flips: view.flips.length,
    Holding: view.openBuys.length,
    'Needs review': view.unmatchedSells.length,
    Data: undefined,
  };

  return (
    <main className="page">
      <header className="masthead">
        <span className="wordmark">
          <Logo />
          Flipbook
        </span>
        <span className="sync-note">
          {settings.lastSyncAt ? `Synced with CSFloat ${formatDate(settings.lastSyncAt)}` : 'Not synced with CSFloat yet'}
        </span>
      </header>

      <SummaryBar summary={view.summary} />

      <nav className="tabs" role="tablist">
        {TABS.map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
            {name}
            {tabCount[name] !== undefined && <span className="tab-count">{tabCount[name]}</span>}
          </button>
        ))}
      </nav>

      {tab === 'Flips' && <FlipsTable flips={view.flips} onChange={refresh} />}
      {tab === 'Holding' && <OpenPositionsTable buys={view.openBuys} />}
      {tab === 'Needs review' && <ReviewPanel unmatched={view.unmatchedSells} onChange={refresh} />}
      {tab === 'Data' && <DataPanel feeRate={settings.feeRate} onChange={refresh} />}
    </main>
  );
}

/** A brass tile with its corner folded over: the same fold that splits bought from sold in the ledger. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 0h10l9 9v10a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5z" fill="var(--brass)" />
      <path d="M15 0v9h9z" fill="var(--bone)" />
      <path d="M7.5 7.5H13v3H9.5v2h3v3h-3v4H6V9z" fill="var(--slate)" />
    </svg>
  );
}
