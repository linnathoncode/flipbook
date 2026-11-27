/** The side panel that shows one trade in full when the sheet is wide enough. */
import type { ReactNode } from 'react';
import { adjustedFloat } from '../../domain/floatRanges';
import type { SheetRow } from '../../domain/listFilters';
import { formatDate, formatDays, formatFloat, formatMoney, formatPercent, formatSignedMoney } from '../format';
import { HoverCardProvider } from './HoverCard';
import { itemTitle, signClass } from './shared';
import { Accessories, AdjustedFloatCell, Estimate, ListedTag, MarketActions, MarketPrices, MatchLabel, type FlipPricing } from './SheetCells';

export function TradeInspector({ row, showMarketPrices, pricing }: { row: SheetRow; showMarketPrices: boolean; pricing?: FlipPricing }) {
  const title = itemTitle(row.item, (row.sell ?? row.buy)?.source);
  const open = row.status === 'open';
  return (
    <HoverCardProvider>
      <div className="trade-inspector" key={row.key}>
        <div>
          <h3>{title.name}</h3>
          <p className="hint">{[title.longDetail, open ? 'Open' : row.status === 'closed' ? 'Closed' : 'Unpaired sale'].filter(Boolean).join(' · ')}</p>
        </div>
        {row.net !== undefined && (
          <div className="inspector-profit">
            <span>Net profit</span>
            <strong className={`pl ${signClass(row.net)}`}>
              {formatSignedMoney(row.net)}{row.percent !== undefined && ` · ${formatPercent(row.percent)}`}
            </strong>
          </div>
        )}
        <TradeDetails row={row} inspector />
        <MarketActions row={row} pricing={open && !showMarketPrices ? pricing : undefined} />
        {open && showMarketPrices && <MarketPrices item={row.item} quote={row.marketQuote}
          onCheck={pricing && (() => pricing.onPrice(row))} busy={pricing?.active === row.key} disabled={pricing?.blocked} />}
      </div>
    </HoverCardProvider>
  );
}

export function TradeDetails({ row, inspector = false }: { row: SheetRow; inspector?: boolean }) {
  const { item, quote } = row;
  const facts: [string, ReactNode][] = [
    ['Adj. float', adjustedFloat(item) === undefined ? null : <AdjustedFloatCell item={item} />],
    ['Pattern seed', item.floatValue === undefined ? null : item.paintSeed],
    ['Fade', item.fadePercent === undefined ? null : `${item.fadePercent.toFixed(1)}%`],
    ['Stickers and charms', item.stickers?.length || item.charms?.length ? <Accessories item={item} /> : null],
    ['Bought', formatDate(row.boughtAt)],
    ['Sold', formatDate(row.soldAt)],
    ['Held', formatDays(row.held)],
    ['Listing', row.listing && <ListedTag listing={row.listing} />],
    ['Match', <MatchLabel row={row} />],
    ['If sold now', quote && <Estimate quote={quote} signed={quote.net}>{formatSignedMoney(quote.net)} ({formatPercent(quote.percent)})</Estimate>],
  ];
  if (inspector) {
    facts.push(
      ['Float', formatFloat(item.floatValue, 6)],
      ['Buy', formatMoney(row.buyPrice)],
      ['Sell', formatMoney(row.sellPrice)],
      ['Fee', formatMoney(row.fee)],
    );
  }
  const available = facts.filter(([, value]) => value != null && value !== '');
  return (
    <dl className="trade-details">
      {available.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
