import { errorText, type SyncOutcome } from './sync';

/** Messages between the dashboard and the background worker, which owns syncing. */
const SYNC_REQUEST = 'flipbook/sync';
const JOURNAL_UPDATED = 'flipbook/journal-updated';

interface SyncRequest {
  type: typeof SYNC_REQUEST;
  openTabIfNeeded: boolean;
}

type SyncReply = { ok: true; outcome: SyncOutcome } | { ok: false; error: string };
type Message = { type?: string };

export async function requestSync(openTabIfNeeded: boolean): Promise<SyncOutcome> {
  const request: SyncRequest = { type: SYNC_REQUEST, openTabIfNeeded };
  const reply = (await chrome.runtime.sendMessage(request)) as SyncReply;
  if (!reply.ok) throw new Error(reply.error);
  return reply.outcome;
}

export function handleSyncRequests(sync: (openTabIfNeeded: boolean) => Promise<SyncOutcome>): void {
  chrome.runtime.onMessage.addListener((message: Message, _sender, reply: (response: SyncReply) => void) => {
    if (message.type !== SYNC_REQUEST) return false;
    sync((message as SyncRequest).openTabIfNeeded)
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
