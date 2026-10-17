import { normalizeItem, type CsfloatItem } from './csfloatTrades';
import { nameKey } from './itemNames';
import { fingerprint } from './matcher';
import type { Item, Trade } from './types';

/** Something the user has up for sale on CSFloat right now. */
export interface Listing {
  id: string;
  priceCents: number;
  listedAt: string;
  auction: boolean;
  item: Item;
}

/** The part of a CSFloat listing we read. */
export interface CsfloatListing {
  id: string;
  created_at: string;
  type?: string;
  state?: string;
  price: number;
  item: CsfloatItem;
}

/** CSFloat answers with either a bare array or `{ data: [...] }`, depending on the endpoint version. */
export function listingsInResponse(body: unknown): CsfloatListing[] {
  const list = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data;
  return Array.isArray(list) ? list.filter(isListing) : [];
}

function isListing(value: unknown): value is CsfloatListing {
  const listing = value as CsfloatListing;
  return typeof listing?.id === 'string' && typeof listing.price === 'number' && typeof listing.item?.market_hash_name === 'string';
}

export function normalizeCsfloatListings(raw: CsfloatListing[]): Listing[] {
  return raw
    .filter((listing) => listing.state === undefined || listing.state === 'listed')
    .map((listing) => ({
      id: listing.id,
      priceCents: listing.price,
      listedAt: listing.created_at,
      auction: listing.type === 'auction',
      item: normalizeItem(listing.item),
    }));
}

/**
 * Which open buy each listing is selling. Skins match on their float fingerprint, like sales do;
 * stickers, cases and other float-less items match by name, oldest buy first.
 */
export function listedBuys(openBuys: Trade[], listings: Listing[]): Map<string, Listing> {
  const listed = new Map<string, Listing>();
  const oldestFirst = [...openBuys].sort((a, b) => a.at.localeCompare(b.at));
  for (const listing of listings) {
    const print = fingerprint(listing.item);
    const buy = print
      ? oldestFirst.filter((candidate) => fingerprint(candidate.item) === print).at(-1)
      : oldestFirst.find((candidate) => candidate.item.floatValue === undefined && !listed.has(candidate.id) && nameKey(candidate.item.marketHashName) === nameKey(listing.item.marketHashName));
    if (buy && !listed.has(buy.id)) listed.set(buy.id, listing);
  }
  return listed;
}
