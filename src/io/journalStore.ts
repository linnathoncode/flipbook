import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Folder, FolderRule } from '../domain/folders';
import type { Listing } from '../domain/listings';
import type { PriceQuote } from '../domain/prices';
import type { Match, Trade } from '../domain/types';
import { DEFAULT_FEE_RATE } from '../domain/profit';

export interface Settings {
  ownerSteamId?: string;
  ownerSteamIdVerified?: boolean;
  feeRate: number;
  lastSyncAt?: string;
  /** Why the most recent sync failed; cleared by the next success. */
  lastSyncError?: string;
  /** Why listings couldn't be read last time. Trades still sync when this is set. */
  listingsError?: string;
  /** Set when CSFloat asked Flipbook to slow down; no prices are fetched before then. */
  pricesPausedUntil?: string;
  rules: FolderRule[];
  orphansToOther: boolean;
}

const DEFAULT_SETTINGS: Settings = { feeRate: DEFAULT_FEE_RATE, rules: [], orphansToOther: true };
const SETTINGS_KEY = 'settings';

interface JournalSchema extends DBSchema {
  trades: { key: string; value: Trade };
  lockedMatches: { key: string; value: Match };
  meta: { key: string; value: Settings };
  folders: { key: string; value: Folder };
  placements: { key: string; value: Placement };
  listings: { key: string; value: Listing };
  prices: { key: string; value: PriceQuote };
}

interface Placement {
  tradeId: string;
  folderId: string;
}

const DB_NAME = 'flipbook';
const DB_VERSION = 4;

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
      if (oldVersion < 3) {
        database.createObjectStore('listings', { keyPath: 'id' });
      }
      if (oldVersion < 4) {
        database.createObjectStore('prices', { keyPath: 'name' });
      }
    },
  });
  return dbPromise;
}

export async function loadTrades(): Promise<Trade[]> {
  return (await db()).getAll('trades');
}

/** Inserts or replaces by trade id, so re-importing the same data never duplicates it. */
export async function saveTrades(trades: Trade[], removedIds: string[]): Promise<void> {
  const tx = (await db()).transaction('trades', 'readwrite');
  await Promise.all([
    ...removedIds.map((id) => tx.store.delete(id)),
    ...trades.map((trade) => tx.store.put(trade)),
    tx.done,
  ]);
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

/** Deleting a folder forgets where its trades were put, so they go back to where Flipbook would file them. */
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

export async function placeTrades(tradeIds: string[], folderId: string): Promise<void> {
  const tx = (await db()).transaction('placements', 'readwrite');
  await Promise.all([...tradeIds.map((tradeId) => tx.store.put({ tradeId, folderId })), tx.done]);
}

export async function loadListings(): Promise<Listing[]> {
  return (await db()).getAll('listings');
}

/** Listings are a snapshot: anything not listed any more drops out. */
export async function replaceListings(listings: Listing[]): Promise<void> {
  const tx = (await db()).transaction('listings', 'readwrite');
  await Promise.all([tx.store.clear(), ...listings.map((listing) => tx.store.put(listing)), tx.done]);
}

export async function loadPrices(): Promise<Map<string, PriceQuote>> {
  const all = await (await db()).getAll('prices');
  return new Map(all.map((quote) => [quote.name, quote]));
}

/** Saves new quotes and drops ones fetched before `keepAfter`, which belong to items no longer held. */
export async function savePrices(quotes: PriceQuote[], keepAfter: string): Promise<void> {
  const tx = (await db()).transaction('prices', 'readwrite');
  const stale = (await tx.store.getAll()).filter((quote) => quote.fetchedAt < keepAfter);
  await Promise.all([...stale.map((quote) => tx.store.delete(quote.name)), ...quotes.map((quote) => tx.store.put(quote)), tx.done]);
}
