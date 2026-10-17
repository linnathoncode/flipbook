import { errorText, type PricingProgress, type SyncOptions, type SyncOutcome } from './sync';

/** Messages between the dashboard and the background worker, which owns syncing. */
const SYNC_REQUEST = 'flipbook/sync';
const JOURNAL_UPDATED = 'flipbook/journal-updated';
const PRICING = 'flipbook/pricing';

interface SyncRequest extends SyncOptions {
  type: typeof SYNC_REQUEST;
}

type SyncReply = { ok: true; outcome: SyncOutcome } | { ok: false; error: string };
type Message = { type?: string };

export async function requestSync(options: SyncOptions): Promise<SyncOutcome> {
  const request: SyncRequest = { type: SYNC_REQUEST, ...options };
  const reply = (await chrome.runtime.sendMessage(request)) as SyncReply;
  if (!reply.ok) throw new Error(reply.error);
  return reply.outcome;
}

export function handleSyncRequests(sync: (options: SyncOptions) => Promise<SyncOutcome>): void {
  chrome.runtime.onMessage.addListener((message: Message, _sender, reply: (response: SyncReply) => void) => {
    if (message.type !== SYNC_REQUEST) return false;
    const { openTabIfNeeded, forcePrices } = message as SyncRequest;
    sync({ openTabIfNeeded, forcePrices })
      .then((outcome) => reply({ ok: true, outcome }))
      .catch((cause: unknown) => reply({ ok: false, error: errorText(cause) }));
    return true; // Keeps the channel open for the async reply.
  });
}

export function announceJournalUpdated(): void {
  // With the dashboard closed nobody is listening; that's expected.
  chrome.runtime.sendMessage({ type: JOURNAL_UPDATED }).catch(() => undefined);
}

export function onJournalUpdated(listener: () => void): () => void {
  const handler = (message: Message) => {
    if (message.type === JOURNAL_UPDATED) listener();
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}

/** Sent after each price lands, so an open dashboard can fill in the row and turn a page. */
export function announcePricing(progress: PricingProgress): void {
  chrome.runtime.sendMessage({ type: PRICING, ...progress }).catch(() => undefined);
}

export function onPricing(listener: (progress: PricingProgress) => void): () => void {
  const handler = (message: Message & Partial<PricingProgress>) => {
    if (message.type === PRICING && message.done !== undefined && message.total !== undefined) {
      listener({ done: message.done, total: message.total });
    }
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
