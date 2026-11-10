import { priceItemFromCsfloat, syncFromCsfloat } from '../src/app/sync';
import type { CsfloatTrade } from '../src/domain/csfloatTrades';
import { loadSettings, loadTrades, saveSettings } from '../src/io/journalStore';

const { stores } = vi.hoisted(() => ({ stores: new Map<string, Map<string, unknown>>() }));

vi.mock('idb', () => {
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  return {
    openDB: async () => ({
      get: async (name: string, id: string) => store(name).get(id),
      getAll: async (name: string) => [...store(name).values()],
      put: async (name: string, value: unknown, key: string) => store(name).set(key, value),
      transaction: (name: string) => ({
        store: {
          put: async (value: { id?: string; name?: string }) => store(name).set((value.id ?? value.name)!, value),
          getAll: async () => [...store(name).values()],
          delete: async (id: string) => store(name).delete(id),
          clear: async () => store(name).clear(),
        },
        done: Promise.resolve(),
      }),
    }),
  };
});

const seller = '76561198000000001';
const buyer = '76561198000000002';
const sample: CsfloatTrade = {
  id: 'sale',
  created_at: '2026-01-01T00:00:00Z',
  state: 'verified',
  buyer_id: buyer,
  seller_id: seller,
  contract: { price: 100, item: { market_hash_name: 'Sticker | Lil Ava' } },
};

function sync(trades: CsfloatTrade[], owner = seller) {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/v1/me') return Response.json({ user: { steam_id: owner } });
    if (url.startsWith('/api/v1/me/trades?')) return Response.json({ trades, count: trades.length });
    if (url.startsWith(`/api/v1/users/${owner}/stall?`)) return Response.json([]);
    throw new Error(`Unexpected CSFloat request: ${url}`);
  });
  return syncFromCsfloat({ openTabIfNeeded: false });
}

beforeEach(() => {
  stores.clear();
  vi.stubGlobal('chrome', {
    tabs: { query: async () => [{ id: 1 }] },
    scripting: {
      executeScript: async ({ func, args }: { func: (...args: unknown[]) => Promise<unknown>; args: unknown[] }) => [
        { result: await func(...args) },
      ],
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

it('syncs an empty account successfully', async () => {
  expect(await sync([])).toEqual({ status: 'synced', added: 0, total: 0 });
  expect(await loadSettings()).toMatchObject({ ownerSteamId: seller, lastSyncAt: expect.any(String) });
  expect(await loadTrades()).toEqual([]);
});

it('records a first-time seller on the correct side of a single trade', async () => {
  expect(await sync([sample])).toEqual({ status: 'synced', added: 1, total: 1 });
  expect(await loadTrades()).toMatchObject([{ id: 'sale', side: 'sell' }]);
});

it('corrects a previously misidentified owner without duplicating the trade', async () => {
  await sync([sample], buyer);
  const settings = await loadSettings();
  await saveSettings({ ...settings, ownerSteamIdVerified: undefined });

  expect(await sync([sample])).toEqual({ status: 'synced', added: 0, total: 1 });
  expect(await loadTrades()).toMatchObject([{ id: 'sale', side: 'sell' }]);
});

it('does not overwrite a confirmed journal when signed in as the counterparty', async () => {
  await sync([sample]);

  await expect(sync([sample], buyer)).rejects.toThrow('different Steam account');
  expect(await loadTrades()).toMatchObject([{ id: 'sale', side: 'sell' }]);
});

it('rejects a profile without a valid Steam ID before importing trades', async () => {
  await expect(sync([sample], '')).rejects.toThrow('Could not read the Steam account');
  expect(await loadTrades()).toEqual([]);
});

it.each(['cancelled', 'failed'])('removes a pending trade that becomes %s and keeps older trades', async (state) => {
  const pending = { ...sample, state: 'pending' };
  await sync([pending, { ...sample, id: 'older' }]);

  await sync([{ ...pending, state }]);
  expect(await loadTrades()).toMatchObject([{ id: 'older', state: 'verified' }]);
});

it('prices one item without syncing trades and reuses a recent quote', async () => {
  const name = '★ StatTrak™ Knife | Example (Factory New)';
  const fetchListings = vi.fn(async (path: string) => {
    const url = new URL(path, 'https://csfloat.com');
    expect(url.pathname).toBe('/api/v1/listings');
    expect(url.searchParams.get('market_hash_name')).toBe(name);
    return Response.json([{ price: 1250 }]);
  });
  vi.stubGlobal('fetch', fetchListings);

  const quote = await priceItemFromCsfloat(name);
  expect(quote).toMatchObject({ name, priceCents: 1250 });
  expect(await priceItemFromCsfloat(name)).toEqual(quote);
  expect(fetchListings).toHaveBeenCalledTimes(1);
});

it('shares the CSFloat rate-limit pause between item lookups', async () => {
  const fetchListings = vi.fn(async () => new Response(null, { status: 429 }));
  vi.stubGlobal('fetch', fetchListings);

  await expect(priceItemFromCsfloat('Sticker | Lil Ava')).rejects.toThrow('30 minutes');
  await expect(priceItemFromCsfloat('Sticker | Crown (Foil)')).rejects.toThrow('paused price lookups');
  expect(fetchListings).toHaveBeenCalledTimes(1);
});
