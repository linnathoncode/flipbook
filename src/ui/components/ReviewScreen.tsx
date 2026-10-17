import type { CSSProperties } from 'react';
import { lockManualMatch } from '../../app/actions';
import type { UnmatchedEntry } from '../../domain/journal';
import { buildFlip, centsToDollars } from '../../domain/profit';
import { formatDate, formatFloat, formatMoney, formatSignedMoney, plural } from '../format';
import { rarityColor } from '../rarity';
import { itemTitle } from './shared';
import { TitleBar, type SyncProps } from './TitleBar';

interface Props {
  review: UnmatchedEntry[];
  /** Sales Flipbook put in Other because no buy was on record. */
  sentToOther: number;
  feeRate: number;
  sync: SyncProps;
  onPaired: (name: string) => void;
  onOpenOther: () => void;
}

export function ReviewScreen({ review, sentToOther, feeRate, sync, onPaired, onOpenOther }: Props) {
  const choose = async (entry: UnmatchedEntry, buyId: string) => {
    await lockManualMatch(entry.sell.id, buyId);
    onPaired(itemTitle(entry.sell.item, entry.sell.source).name);
  };

  return (
    <>
      <header className="top">
        <TitleBar title="Needs review" {...sync} />
        <p className="note">Sales Flipbook couldn't pair by itself.</p>
      </header>
      <div className="page">
        {review.length > 0 ? (
          <>
            <div>
              <h2 className="section-title">Which buy was it?</h2>
              <p className="note">More than one earlier buy could be the item you sold. Pick the right one and the flip goes onto your sheet.</p>
            </div>
            {review.map((entry) => (
              <ReviewCard key={entry.sell.id} entry={entry} feeRate={feeRate} onChoose={(buyId) => choose(entry, buyId)} />
            ))}
          </>
        ) : (
          <div className="card">
            <h2>All clear</h2>
            <p className="note flush">Every sale is paired with its buy.</p>
          </div>
        )}
        {sentToOther > 0 && (
          <div className="card">
            <h2>Sent to Other</h2>
            <p className="note">{plural(sentToOther, 'sale')} had no buy on record, so Flipbook put them in Other.</p>
            <button className="btn" onClick={onOpenOther}>Open Other</button>
          </div>
        )}
      </div>
    </>
  );
}

function ReviewCard({ entry, feeRate, onChoose }: { entry: UnmatchedEntry; feeRate: number; onChoose: (buyId: string) => void }) {
  const { sell } = entry;
  const title = itemTitle(sell.item, sell.source);
  return (
    <div className="card">
      <div className="rv">
        <span className="itm">
          <span className="rar" style={{ '--r': rarityColor(sell.item) ?? 'var(--rule)' } as CSSProperties} aria-hidden="true" />
          <span className="nm">{title.name}</span>
          {title.detail && <span className="wear">{title.detail}</span>}
        </span>
        <span className="hint">Sold {formatDate(sell.at)} for {formatMoney(centsToDollars(sell.priceCents))}</span>
      </div>
      <div className="cands">
        {entry.candidates.map((buy) => {
          const flip = buildFlip({ sellId: sell.id, buyId: buy.id, confidence: 'manual' }, buy, sell, feeRate);
          return (
            <button key={buy.id} className="btn" onClick={() => onChoose(buy.id)}>
              <b>{formatMoney(flip.buyPrice)}</b>
              <span>
                Bought {formatDate(buy.at)}
                {buy.item.floatValue !== undefined && `, float ${formatFloat(buy.item.floatValue)}`}. Would net {formatSignedMoney(flip.netProfit)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
