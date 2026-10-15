import type { CsfloatTrade, CsfloatTradesPage } from '../domain/csfloatTrades';

const CSFLOAT_ORIGIN = 'https://csfloat.com';
const PAGE_SIZE = 100;
/** Hard stop so a misbehaving API can't loop forever. */
const MAX_PAGES = 100;

/**
 * Downloads the full trade history using the user's logged-in CSFloat session.
 *
 * The request runs inside a csfloat.com tab, so the browser attaches the
 * session cookie itself — no API key is ever read or stored by the extension.
 */
export async function fetchAllCsfloatTrades(): Promise<CsfloatTrade[]> {
  const { tabId, openedByUs } = await acquireCsfloatTab();
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: fetchTradePagesInPage,
      args: [PAGE_SIZE, MAX_PAGES],
    });
    const result = injection?.result as PageFetchResult | undefined;
    if (!result) throw new Error('CSFloat tab did not return a result.');
    if ('error' in result) throw new Error(result.error);
    return result.trades;
  } finally {
    if (openedByUs) await chrome.tabs.remove(tabId);
  }
}

type PageFetchResult = { trades: CsfloatTrade[] } | { error: string };

/** Runs in the csfloat.com page context. Must stay self-contained: no imports or closures. */
async function fetchTradePagesInPage(pageSize: number, maxPages: number): Promise<PageFetchResult> {
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
    if (isLastPage) return { trades };
  }
  return { trades };
}

async function acquireCsfloatTab(): Promise<{ tabId: number; openedByUs: boolean }> {
  const [existing] = await chrome.tabs.query({ url: `${CSFLOAT_ORIGIN}/*` });
  if (existing?.id !== undefined) return { tabId: existing.id, openedByUs: false };

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
