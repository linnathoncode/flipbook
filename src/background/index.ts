import { announceJournalUpdated, handleSyncRequests } from '../app/messages';
import { isSyncStale, syncFromCsfloat, type SyncOutcome } from '../app/sync';
import { CSFLOAT_ORIGIN } from '../io/csfloatSync';

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');
const SYNC_ALARM = 'flipbook/periodic-sync';
const SYNC_INTERVAL_MINUTES = 30;

let runningSync: Promise<SyncOutcome> | undefined;

/** One sync at a time, however many triggers fire together. */
function sync(openTabIfNeeded: boolean): Promise<SyncOutcome> {
  runningSync ??= syncFromCsfloat({ openTabIfNeeded })
    .then((outcome) => {
      if (outcome.status === 'synced') announceJournalUpdated();
      return outcome;
    })
    .finally(() => {
      runningSync = undefined;
    });
  return runningSync;
}

/** Background triggers only use a CSFloat tab the user already has open. */
async function syncIfStale(): Promise<void> {
  if (!(await isSyncStale())) return;
  // A failure is stored with the settings; telling the dashboard lets it show the error.
  await sync(false).catch(announceJournalUpdated);
}

handleSyncRequests(sync);

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) void syncIfStale();
});

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === 'complete' && tab.url?.startsWith(CSFLOAT_ORIGIN)) void syncIfStale();
});

chrome.action.onClicked.addListener(async () => {
  const [existing] = await chrome.tabs.query({ url: DASHBOARD_URL });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    return;
  }
  await chrome.tabs.create({ url: DASHBOARD_URL });
});
