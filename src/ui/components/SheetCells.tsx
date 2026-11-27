/** The cells and small pieces a sheet row is built from, shared by the table and the trade inspector. */
import type { CSSProperties, ReactNode } from 'react';
import { adjustedFloat, floatRange, type FloatRange } from '../../domain/floatRanges';
import type { ListedFor, PricedAt, SheetRow } from '../../domain/listFilters';
import { itemPriceKey, type PriceQuote } from '../../domain/prices';
import { centsToDollars } from '../../domain/profit';
import type { Item } from '../../domain/types';
import { CSFLOAT_ORIGIN } from '../../io/csfloatSync';
import { formatDate, formatFloat, formatMoney, formatPercent, formatSignedMoney, formatTimeAgo, roundTo } from '../format';
import { rarityColor } from '../rarity';
import { steamImageUrl } from '../steamImages';
import { useHoverCard, type CardContent } from './HoverCard';
import { RollingNumber } from './RollingNumber';
import { Signal } from './Signal';
import { CONFIDENCE, itemTitle, signClass } from './shared';

/** How a row asks CSFloat for its price, and whether it may right now. */
export interface FlipPricing {
  active?: string;
  /** A price request is already running (this row's, another row's, or a held-items batch), so no new one may start. */
  blocked: boolean;
  requested: string[];
  quotes: ReadonlyMap<string, PriceQuote>;
  onPrice: (row: SheetRow) => void;
}


/** A profit bar is full at this gain or loss, in percent. */
export const PROFIT_BAR_LIMIT = 20;

export function MarketActions({ row, pricing }: { row: SheetRow; pricing?: FlipPricing }) {
  const name = row.item.marketHashName;
  const href = `${CSFLOAT_ORIGIN}/search?market_hash_name=${encodeURIComponent(name)}&sort_by=lowest_price&type=buy_now`;
  const quote = pricing?.requested.includes(row.key) ? pricing.quotes.get(name) : undefined;
  const busy = pricing?.active === row.key;
  const priceHint = quote && `Checked ${formatTimeAgo(quote.fetchedAt)}. Click to refresh.`;
  return (
    <span className="market-actions">
      <a className="market-link" href={href} target="_blank" rel="noreferrer" aria-label={`View CSFloat listings for ${name} (opens in a new tab)`}>
        Listings <span aria-hidden="true">↗</span>
      </a>
      {pricing && (
        <button className="link market-link market-price" disabled={pricing.blocked} onClick={() => pricing.onPrice(row)} title={priceHint}
          aria-label={busy ? `Pricing ${name}` : quote ? `Refresh price for ${name}` : `Price item: ${name}`}>
          <span aria-live="polite">{busy ? 'Pricing…' : quote ? 'Refresh prices' : 'Price item'}</span>
          {busy && <span className="row-price-signal"><Signal compact /></span>}
          {quote && !busy && <span aria-hidden="true">↻</span>}
        </button>
      )}
      {quote && <MarketPrices item={row.item} quote={quote} />}
    </span>
  );
}

export function MarketPrices({ item, quote, onCheck, busy, disabled }: { item: Item; quote?: PriceQuote; onCheck?: () => void; busy?: boolean; disabled?: boolean }) {
  const bid = quote?.instantSell?.[itemPriceKey(item)];
  const lowest = !quote ? 'Not checked' : quote.priceCents === undefined ? 'No listings' : formatMoney(centsToDollars(quote.priceCents));
  const instant = bid?.status !== 'matched' ? 'Unavailable' : bid.priceCents === undefined ? 'No matching orders' : formatMoney(centsToDollars(bid.priceCents));
  return (
    <span className="market-quotes">
      <span title={quote && `Lowest buy-now listing for this market name, before fees. Checked ${formatTimeAgo(quote.fetchedAt)}.`}>
        <span className="market-quote-label">Lowest list</span> {lowest}
      </span>
      <span title={bid?.status === 'matched' ? `Highest buy order matching this item's attributes, before fees. Checked ${formatTimeAgo(bid.fetchedAt)}.` : bid ? 'Could not verify matching buy orders for this item. Check buy orders to try again.' : 'Buy orders are checked manually for this item.'}>
        <span className="market-quote-label">Insta sell</span> {bid || !onCheck ? instant : ''}
        {onCheck && <button className="link buy-order-check" onClick={onCheck} disabled={disabled}
          aria-label={`${busy ? 'Checking' : bid ? 'Refresh' : 'Check'} buy orders for ${item.marketHashName}`}>
          <span aria-live="polite">{busy ? 'Checking…' : bid ? 'Refresh' : 'Check buy orders'}</span>
          {busy && <span className="row-price-signal"><Signal compact /></span>}
        </button>}
      </span>
    </span>
  );
}

export function NetCell({ row, onPickBuy }: { row: SheetRow; onPickBuy: () => void }) {
  if (row.listing) return <ListedTag listing={row.listing} />;
  if (row.status === 'open') return <span className="tag open">Open</span>;
  if (row.ambiguous) return <button className="link" onClick={onPickBuy}>Pick buy</button>;
  if (row.status === 'sale') return <span className="tag open">No buy</span>;
  return <>{row.net === undefined ? '' : formatSignedMoney(row.net)}</>;
}

/** An open buy that's up for sale: the asking price, and what it nets if it sells there. */
export function ListedTag({ listing }: { listing: ListedFor }) {
  const what = listing.auction ? 'Auction from' : 'Listed at';
  const hint = `${what} ${formatMoney(listing.price)} since ${formatDate(listing.listedAt)}. Nets ${formatSignedMoney(listing.net)} (${formatPercent(listing.percent)}) if it sells there.`;
  return (
    <span className="tag listed" title={hint}>
      {listing.auction ? 'Auction' : 'Listed'} {formatMoney(listing.price)}
    </span>
  );
}

/**
 * A figure for an open buy worked out from today's CSFloat price, not from a sale.
 * Muted, so it never reads as money already made.
 */
export function Estimate({ quote, signed, children }: { quote: PricedAt; signed?: number; children: ReactNode }) {
  const estimate = quote.estimate === undefined ? '' : ` CSFloat estimates ${formatMoney(quote.estimate)}.`;
  const hint = `Cheapest CSFloat listing ${formatTimeAgo(quote.fetchedAt)}: ${formatMoney(quote.price)}.${estimate} Sold there, this nets ${formatSignedMoney(quote.net)} after the fee.`;
  return (
    <span className={`est ${signed === undefined ? '' : signClass(signed)}`} title={hint}>
      {children}
    </span>
  );
}

export function MatchLabel({ row }: { row: SheetRow }) {
  if (row.match) {
    const { label, hint } = CONFIDENCE[row.match];
    return <span className={`match ${row.match === 'suggested' ? 'check' : ''}`} title={hint}>{label}</span>;
  }
  if (row.status === 'open') return <span className="match">Awaiting sale</span>;
  return <span className="match">{row.ambiguous ? 'Pick buy' : 'No buy'}</span>;
}

export function ProfitPercent({ percent, detailed }: { percent: number; detailed: boolean }) {
  const magnitude = roundTo(Math.abs(percent), 1);
  const tone = magnitude === 0 ? '' : percent < 0 ? 'neg' : 'pos';
  const extent = Math.min(magnitude / PROFIT_BAR_LIMIT, 1) * 50;
  return (
    <span className={`profit-result ${tone}`}>
      <RollingNumber value={percent} text={magnitude === 0 ? '0.0%' : formatPercent(Math.sign(percent) * magnitude)} zero="0.0%" />
      {detailed && (
        <span className="profit-track" aria-hidden="true">
          {tone && <span className="profit-bar" style={{ width: `${extent}%` }} />}
        </span>
      )}
    </span>
  );
}

export function ItemCell({ row, detailed, isNew, pricing }: { row: SheetRow; detailed: boolean; isNew: boolean; pricing?: FlipPricing }) {
  const { item } = row;
  const title = itemTitle(item, (row.sell ?? row.buy)?.source);
  const pending = [row.buy, row.sell].some((trade) => trade?.state === 'pending');
  const tags = (
    <>
      {isNew && <span className="tag new">New</span>}
      {pending && <span className="tag pending">Pending</span>}
    </>
  );
  const color = rarityColor(item) ?? 'var(--rule)';
  const hover = useHoverCard();
  const seed = item.paintSeed !== undefined && item.floatValue !== undefined ? `Seed ${item.paintSeed}` : undefined;
  const fade = item.fadePercent !== undefined ? `Fade ${item.fadePercent.toFixed(1)}%` : undefined;
  const card: CardContent = {
    iconUrl: item.iconUrl,
    title: title.name,
    lines: [title.longDetail, item.floatValue === undefined ? undefined : `Float ${item.floatValue}`, seed, fade].filter(isText),
    shape: 'item',
    color,
  };

  return (
    <div className="itm">
      {detailed ? (
        <span className="tile" style={{ '--r': color } as CSSProperties} aria-hidden="true" {...hover(card)}>
          <SteamImage iconUrl={item.iconUrl} width={128} height={96} />
        </span>
      ) : <span className="rar" style={{ '--r': color } as CSSProperties} aria-hidden="true" />}
      <div className="item-title">
        <span className="nm" {...hover(card)}>{title.name}</span>
        {title.detail && <span className="wear">{title.detail}</span>}
        {tags}
        <MarketActions row={row} pricing={pricing} />
      </div>
    </div>
  );
}

export function Accessories({ item }: { item: Item }) {
  const stickers = [...(item.stickers ?? [])].sort((a, b) => a.slot - b.slot);
  const charms = item.charms ?? [];
  const hover = useHoverCard();
  if (stickers.length === 0 && charms.length === 0) return null;
  return (
    <span className="acc">
      {stickers.map((sticker, index) => (
        <span key={index} className="stk" aria-label={sticker.name} {...hover({ iconUrl: sticker.iconUrl, title: withoutPrefix(sticker.name), lines: [scrapeNote(sticker.wear)], shape: 'square' })}>
          <SteamImage iconUrl={sticker.iconUrl} width={64} fallback={withoutPrefix(sticker.name).charAt(0)} />
        </span>
      ))}
      {charms.map((charm, index) => (
        <span
          key={index}
          className="charm"
          aria-label={charm.name}
          {...hover({ iconUrl: charm.iconUrl, title: withoutPrefix(charm.name), lines: charm.pattern === undefined ? ['Charm'] : [`Charm, pattern #${charm.pattern}`], shape: 'square' })}
        >
          <SteamImage iconUrl={charm.iconUrl} width={64} fallback="" />
          {charm.pattern !== undefined && <span>#{charm.pattern}</span>}
        </span>
      ))}
    </span>
  );
}

export function scrapeNote(wear?: number): string {
  return wear ? `${Math.round(wear * 100)}% scraped` : 'Not scraped';
}

/** "Sticker | Crown (Foil)" reads as just "Crown (Foil)" under a picture of the sticker. */
export const withoutPrefix = (name: string) => name.replace(/^(Sticker|Patch|Charm) \| /, '');

export const isText = (value: string | undefined): value is string => Boolean(value);

/** Hides itself if Steam doesn't answer, leaving the tile's rarity color or the fallback letter. */
export function SteamImage({ iconUrl, width, height = width, fallback }: { iconUrl?: string; width: number; height?: number; fallback?: string }) {
  const src = steamImageUrl(iconUrl, width, height);
  if (!src) return fallback ? <span className="fallback">{fallback}</span> : null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(event) => event.currentTarget.classList.add('in')}
      onError={(event) => (event.currentTarget.hidden = true)}
    />
  );
}

export const rangeText = (range: FloatRange) => `${range.min.toFixed(2)} to ${range.max.toFixed(2)}`;

export function FloatCell({ item, detailed }: { item: Item; detailed: boolean }) {
  const value = item.floatValue;
  if (value === undefined) return null;
  const range = detailed ? floatRange(item) : undefined;
  return (
    <span className={range ? 'flt' : undefined} title={String(value)}>
      <RollingNumber value={value} text={formatFloat(value, 6)} zero="0.000000" />
      {range && (
        <span className="wbar" style={{ '--f': value, '--lo': range.min, '--hi': range.max } as CSSProperties}
          title={`${item.wearName ?? 'Wear'}. This skin's floats run ${rangeText(range)}.`}>
          <b className="cap l" />
          <b className="cap r" />
          <i />
        </span>
      )}
    </span>
  );
}

export function AdjustedFloatCell({ item }: { item: Item }) {
  const range = floatRange(item);
  const adjusted = adjustedFloat(item);
  if (!range || adjusted === undefined) return null;
  return (
    <span className="flt">
      <span>{formatFloat(adjusted)}</span>
      <span className="capt">of {rangeText(range)}</span>
    </span>
  );
}
