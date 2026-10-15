import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Match, Trade } from '../domain/types';
import { DEFAULT_FEE_RATE } from '../domain/profit';

export interface Settings {
  ownerSteamId?: string;
  feeRate: number;
  lastSyncAt?: string;
}

const DEFAULT_SETTINGS: Settings = { feeRate: DEFAULT_FEE_RATE };
const SETTINGS_KEY = 'settings';

interface JournalSchema extends DBSchema {
  trades: { key: string; value: Trade };
  lockedMatches: { key: string; value: Match };
  meta: { key: string; value: Settings };
}

const DB_NAME = 'csfloat-trade-journal';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<JournalSchema>> | undefined;

function db() {
  dbPromise ??= openDB<JournalSchema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('trades', { keyPath: 'id' });
      database.createObjectStore('lockedMatches', { keyPath: 'sellId' });
      database.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadTrades(): Promise<Trade[]> {
  return (await db()).getAll('trades');
}

/** Inserts or replaces by trade id, so re-importing the same data never duplicates it. */
export async function saveTrades(trades: Trade[]): Promise<void> {
  const tx = (await db()).transaction('trades', 'readwrite');
  await Promise.all([...trades.map((trade) => tx.store.put(trade)), tx.done]);
}

export async function loadLockedMatches(): Promise<Match[]> {
  return (await db()).getAll('lockedMatches');
}

export async function lockMatch(match: Match): Promise<void> {
  await (await db()).put('lockedMatches', match);
}

export async function unlockMatch(sellId: string): Promise<void> {
  await (await db()).delete('lockedMatches', sellId);
}

export async function loadSettings(): Promise<Settings> {
  const stored = await (await db()).get('meta', SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('meta', settings, SETTINGS_KEY);
}
