import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Folder } from '../domain/folders';
import type { Match, Trade } from '../domain/types';
import { DEFAULT_FEE_RATE } from '../domain/profit';

export interface Settings {
  ownerSteamId?: string;
  feeRate: number;
  lastSyncAt?: string;
  /** Why the most recent sync failed; cleared by the next success. */
  lastSyncError?: string;
}

const DEFAULT_SETTINGS: Settings = { feeRate: DEFAULT_FEE_RATE };
const SETTINGS_KEY = 'settings';

interface JournalSchema extends DBSchema {
  trades: { key: string; value: Trade };
  lockedMatches: { key: string; value: Match };
  meta: { key: string; value: Settings };
  folders: { key: string; value: Folder };
  placements: { key: string; value: Placement };
}

interface Placement {
  tradeId: string;
  folderId: string;
}

const DB_NAME = 'flipbook';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<JournalSchema>> | undefined;

function db() {
  dbPromise ??= openDB<JournalSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('trades', { keyPath: 'id' });
        database.createObjectStore('lockedMatches', { keyPath: 'sellId' });
        database.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        database.createObjectStore('folders', { keyPath: 'id' });
        database.createObjectStore('placements', { keyPath: 'tradeId' });
      }
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

export async function loadFolders(): Promise<Folder[]> {
  return (await db()).getAll('folders');
}

export async function saveFolder(folder: Folder): Promise<void> {
  await (await db()).put('folders', folder);
}

/** Deleting a folder sends its trades back to the main book. */
export async function deleteFolder(folderId: string): Promise<void> {
  const tx = (await db()).transaction(['folders', 'placements'], 'readwrite');
  const placements = tx.objectStore('placements');
  const owned = (await placements.getAll()).filter((placement) => placement.folderId === folderId);
  await Promise.all([
    tx.objectStore('folders').delete(folderId),
    ...owned.map((placement) => placements.delete(placement.tradeId)),
    tx.done,
  ]);
}

export async function loadPlacements(): Promise<Map<string, string>> {
  const all = await (await db()).getAll('placements');
  return new Map(all.map((placement) => [placement.tradeId, placement.folderId]));
}

/** A null folder puts the trades back in the main book. */
export async function placeTrades(tradeIds: string[], folderId: string | null): Promise<void> {
  const tx = (await db()).transaction('placements', 'readwrite');
  const writes = tradeIds.map((tradeId) =>
    folderId === null ? tx.store.delete(tradeId) : tx.store.put({ tradeId, folderId }),
  );
  await Promise.all([...writes, tx.done]);
}
