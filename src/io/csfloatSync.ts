import type { CsfloatTrade, CsfloatTradesPage } from '../domain/csfloatTrades';

export const CSFLOAT_ORIGIN = 'https://csfloat.com';
const PAGE_SIZE = 100;
const LISTINGS_PAGE_SIZE = 40;
/** Spacing between price requests, so a full Holds page looks like someone browsing the market. */
export const PRICE_REQUEST_GAP_MS = 1000;
/** Hard stop so a misbehaving API can't loop forever. */
const MAX_PAGES = 100;

/** Requests made through the user's logged-in CSFloat tab. */
export interface CsfloatSession {
  steamId(): Promise<string>;
  /** The full trade history. */
  trades(): Promise<CsfloatTrade[]>;
  /** What the account has listed right now, as CSFloat sent it. */
  listings(steamId: string): Promise<unknown[]>;
  /** The cheapest buy-now listing for one item. Callers space these out; see PRICE_REQUEST_GAP_MS. */
  cheapestListing(name: string): Promise<CheapestListing>;
}

/** CSFloat's raw answer, or that it asked us to slow down, or that this one request failed. */
export type CheapestListing = { body: unknown } | { rateLimited: true } | { failed: true };

/**
 * Runs `use` with requests that execute inside a csfloat.com tab, so the browser attaches the
 * session cookie itself. No API key is ever read or stored by the extension.
 *
 * Returns undefined when no CSFloat tab is open and opening one isn't allowed,
 * so background syncs never pop up tabs on their own.
 */
export async function withCsfloatSession<T>(
  { openTabIfNeeded }: { openTabIfNeeded: boolean },
  use: (session: CsfloatSession) => Promise<T>,
): Promise<T | undefined> {
  const existingTabId = await findCsfloatTab();
  if (existingTabId === undefined && !openTabIfNeeded) return undefined;
  const { tabId, openedByUs } =
    existingTabId === undefined ? await openCsfloatTab() : { tabId: existingTabId, openedByUs: false };

  const run = async <R>(func: (...args: never[]) => Promise<PageResult<R>>, args: unknown[]): Promise<R> => {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: func as () => Promise<PageResult<R>>, args: args as [] });
    const result = injection?.result as PageResult<R> | undefined;
    if (!result) throw new Error('CSFloat tab did not return a result.');
    if ('error' in result) throw new Error(result.error);
    return result.value;
  };

  try {
    return await use({
      steamId: () => run(fetchSteamIdInPage, []),
      trades: () => run(fetchTradePagesInPage, [PAGE_SIZE, MAX_PAGES]),
      listings: (steamId) => run(fetchListingPagesInPage, [steamId, LISTINGS_PAGE_SIZE, MAX_PAGES]),
      cheapestListing: (name) => run(fetchCheapestListingInPage, [name]),
    });
  } finally {
    if (openedByUs) await chrome.tabs.remove(tabId);
  }
}

type PageResult<T> = { value: T } | { error: string };

async function fetchSteamIdInPage(): Promise<PageResult<string>> {
  const response = await fetch('/api/v1/me', { credentials: 'include' });
  if (response.status === 401 || response.status === 403) {
    return { error: 'Not logged in to CSFloat. Log in at csfloat.com and sync again.' };
  }
  if (!response.ok) return { error: `CSFloat returned HTTP ${response.status} for your profile.` };

  const body = (await response.json()) as { user?: { steam_id?: unknown } } | null;
  const steamId = body?.user?.steam_id;
  if (typeof steamId !== 'string' || !/^\d{17}$/.test(steamId)) {
    return { error: 'Could not read the Steam account from your CSFloat profile. Check that you are logged in and sync again.' };
  }
  return { value: steamId };
}

/** Runs in the csfloat.com page context. Must stay self-contained: no imports or closures. */
async function fetchTradePagesInPage(pageSize: number, maxPages: number): Promise<PageResult<CsfloatTrade[]>> {
  const trades: CsfloatTrade[] = [];
  for (let page = 0; page < maxPages; page++) {
    const response = await fetch(`/api/v1/me/trades?page=${page}&limit=${pageSize}`, {
      credentials: 'include',
    });
    if (response.status === 401 || response.status === 403) {
      return { error: 'Not logged in to CSFloat. Log in at csfloat.com and sync again.' };
    }
    if (!response.ok) return { error: `CSFloat returned HTTP ${response.status}.` };

    const body = (await response.json()) as CsfloatTradesPage;
    trades.push(...body.trades);
    const isLastPage = body.trades.length === 0 || trades.length >= body.count;
    if (isLastPage) return { value: trades };
  }
  return { value: trades };
}

/**
 * Runs in the csfloat.com page context. Your stall is the list of your active listings.
 * Pages follow CSFloat's cursor; a bare array means it all came in one go.
 */
async function fetchListingPagesInPage(steamId: string, pageSize: number, maxPages: number): Promise<PageResult<unknown[]>> {
  const listings: unknown[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const query = `limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const response = await fetch(`/api/v1/users/${encodeURIComponent(steamId)}/stall?${query}`, { credentials: 'include' });
    if (!response.ok) return { error: `CSFloat returned HTTP ${response.status} for your listings.` };

    const body = (await response.json()) as unknown;
    if (Array.isArray(body)) return { value: [...listings, ...body] };
    const { data, cursor: next } = (body ?? {}) as { data?: unknown[]; cursor?: string };
    if (!Array.isArray(data)) return { error: 'CSFloat sent listings in a shape Flipbook does not know.' };
    listings.push(...data);
    if (!next || next === cursor || data.length < pageSize) return { value: listings };
    cursor = next;
  }
  return { value: listings };
}

/** Runs in the csfloat.com page context. One price lookup; the background spaces them out. */
async function fetchCheapestListingInPage(name: string): Promise<PageResult<CheapestListing>> {
  const query = `market_hash_name=${encodeURIComponent(name)}&sort_by=lowest_price&type=buy_now&limit=1`;
  const response = await fetch(`/api/v1/listings?${query}`, { credentials: 'include' });
  if (response.status === 429) return { value: { rateLimited: true } };
  if (response.status === 401 || response.status === 403) {
    return { error: 'Not logged in to CSFloat. Log in at csfloat.com and sync again.' };
  }
  return { value: response.ok ? { body: await response.json() } : { failed: true } };
}

/** A loaded, awake tab can run the fetch; a discarded one can't. */
async function findCsfloatTab(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ url: `${CSFLOAT_ORIGIN}/*`, status: 'complete', discarded: false });
  return tabs.find((tab) => tab.id !== undefined)?.id;
}

async function openCsfloatTab(): Promise<{ tabId: number; openedByUs: boolean }> {
  const created = await chrome.tabs.create({ url: CSFLOAT_ORIGIN, active: false });
  if (created.id === undefined) throw new Error('Could not open a CSFloat tab.');
  await waitForTabLoaded(created.id);
  return { tabId: created.id, openedByUs: true };
}

function waitForTabLoaded(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (updatedId: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (updatedId !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
