import { priceItemFromCsfloat, syncFromCsfloat } from '../src/app/sync';
import type { CsfloatTrade } from '../src/domain/csfloatTrades';
import { loadPrices, loadSettings, loadTrades, placeTrades, savePrices, saveSettings } from '../src/io/journalStore';
import { itemPriceKey } from '../src/domain/prices';
import { normalizeItem } from '../src/domain/csfloatTrades';

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
      executeScript: async ({ func, args }: { func: (...args: unknown[]) => Promise<unknown>; args: unknown[] }) => {
        const serializedArgs = JSON.parse(JSON.stringify(args)) as unknown[];
        expect(args).toStrictEqual(serializedArgs);
        return [{ result: await func(...serializedArgs) }];
      },
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

it('uses each signed item inspection for matching orders and isolates same-name quotes', async () => {
  const first = normalizeItem({ market_hash_name: 'Skin', type: 'skin', float_value: 0.01, paint_seed: 1, serialized_inspect: 'inspect-one', gs_sig: 'sig-one' });
  const second = { ...first, floatValue: 0.2, paintSeed: 2, inspectLink: 'inspect-two', inspectSignature: 'sig-two' };
  const fetchPrice = vi.fn(async (path: string) => {
    const url = new URL(path, 'https://csfloat.com');
    if (url.pathname === '/api/v1/listings') return Response.json([{ id: 'unrelated-cheapest-skin', price: 1500 }]);
    expect(url.pathname).toBe('/api/v1/buy-orders/item');
    expect(url.searchParams.get('market_hash_name')).toBe('Skin');
    const firstItem = url.searchParams.get('url') === 'inspect-one';
    expect(url.searchParams.get('sig')).toBe(firstItem ? 'sig-one' : 'sig-two');
    return Response.json([{ price: firstItem ? 1200 : 800, qty: 1 }]);
  });
  vi.stubGlobal('fetch', fetchPrice);
  const one = await priceItemFromCsfloat(first);
  expect(one.instantSell?.[itemPriceKey(first)]).toMatchObject({ priceCents: 1200, status: 'matched' });
  const two = await priceItemFromCsfloat(second);
  expect(two.instantSell?.[itemPriceKey(second)]?.priceCents).toBe(800);
  expect(two.instantSell?.[itemPriceKey(first)]?.priceCents).toBe(1200);
  await priceItemFromCsfloat(second);
  expect(fetchPrice).toHaveBeenCalledTimes(4);
});

it('resolves the exact inventory item before requesting float and pattern matching', async () => {
  const item = normalizeItem({ market_hash_name: 'Skin', type: 'skin', float_value: 0.03, paint_seed: 12, paint_index: 4 });
  vi.stubGlobal('fetch', async (path: string) => {
    if (path.startsWith('/api/v1/listings?')) return Response.json([{ id: 'cheapest-other-seed', price: 500 }]);
    if (path === '/api/v1/me/inventory') return Response.json([
      { market_hash_name: 'Skin', float_value: 0.03, paint_seed: 99, paint_index: 4, serialized_inspect: 'wrong', gs_sig: 'wrong' },
      { market_hash_name: 'Skin', float_value: 0.03, paint_seed: 12, paint_index: 4, serialized_inspect: 'correct', gs_sig: 'signed' },
    ]);
    const url = new URL(path, 'https://csfloat.com');
    expect(url.pathname).toBe('/api/v1/buy-orders/item');
    expect(url.searchParams.get('url')).toBe('correct');
    expect(url.searchParams.get('sig')).toBe('signed');
    return Response.json([]);
  });
  const quote = await priceItemFromCsfloat(item);
  expect(quote.instantSell?.[itemPriceKey(item)]).toMatchObject({ status: 'matched', priceCents: undefined });
});

it('keeps the lowest listing but marks instant sell unavailable when the item cannot be verified', async () => {
  const item = normalizeItem({ market_hash_name: 'Skin', type: 'skin', float_value: 0.03, paint_seed: 12 });
  const fetchPrice = vi.fn(async (path: string) => path === '/api/v1/me/inventory' ? Response.json([]) : Response.json([{ id: 'wrong-pattern', price: 500 }]));
  vi.stubGlobal('fetch', fetchPrice);
  const quote = await priceItemFromCsfloat(item);
  expect(quote.priceCents).toBe(500);
  expect(quote.instantSell?.[itemPriceKey(item)]?.status).toBe('unavailable');
  expect(fetchPrice).toHaveBeenCalledTimes(2);
});

it('uses listing-matched orders for interchangeable stickers', async () => {
  const item = normalizeItem({ market_hash_name: 'Sticker | A', type: 'sticker' });
  vi.stubGlobal('fetch', async (path: string) => {
    if (path.startsWith('/api/v1/listings?')) return Response.json([{ id: 'sticker-listing', price: 500 }]);
    expect(path).toBe('/api/v1/listings/sticker-listing/buy-orders?limit=1&exclude_own=true');
    return Response.json([{ price: 400 }]);
  });
  const quote = await priceItemFromCsfloat(item);
  expect(quote.instantSell?.[itemPriceKey(item)]?.priceCents).toBe(400);
});

it('preserves lowest-list data and pauses requests when buy-order lookup is rate limited', async () => {
  const item = normalizeItem({ market_hash_name: 'Skin', type: 'skin', serialized_inspect: 'inspect', gs_sig: 'sig' });
  vi.stubGlobal('fetch', async (path: string) => path.startsWith('/api/v1/listings?') ? Response.json([{ price: 500 }]) : new Response(null, { status: 429 }));
  await expect(priceItemFromCsfloat(item)).rejects.toThrow('30 minutes');
  expect((await loadPrices()).get(item.marketHashName)?.priceCents).toBe(500);
  expect((await loadSettings()).pricesPausedUntil).toBeDefined();
  await expect(priceItemFromCsfloat(item)).rejects.toThrow('paused price lookups');
});

it.each([false, true])('Holds batch pricing only fetches listings and preserves manual buy-order quotes, forced=%s', async (forcePrices) => {
  const raw: CsfloatTrade = { ...sample, buyer_id: seller, seller_id: buyer };
  const name = raw.contract.item.market_hash_name;
  const item = normalizeItem(raw.contract.item);
  const oldDate = new Date(Date.now() - 2 * 86400_000).toISOString();
  const bid = { status: 'matched' as const, priceCents: 80, fetchedAt: oldDate };
  await placeTrades([raw.id], 'holds');
  await savePrices([{ name, priceCents: 100, fetchedAt: oldDate, instantSell: { [itemPriceKey(item)]: bid } }], '2000-01-01');
  const fetchPrice = vi.fn(async (path: string) => {
    if (path === '/api/v1/me') return Response.json({ user: { steam_id: seller } });
    if (path.startsWith('/api/v1/me/trades?')) return Response.json({ trades: [raw], count: 1 });
    if (path.startsWith(`/api/v1/users/${seller}/stall?`)) return Response.json([]);
    if (path.startsWith('/api/v1/listings?')) return Response.json([{ price: 150 }]);
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal('fetch', fetchPrice);
  await syncFromCsfloat({ openTabIfNeeded: false, forcePrices });
  const quote = (await loadPrices()).get(name)!;
  expect(quote.priceCents).toBe(150);
  expect(quote.instantSell?.[itemPriceKey(item)]).toEqual(bid);
  expect(fetchPrice).toHaveBeenCalledTimes(4);
});

it('does not refresh a fresh Holds listing just because no buy-order quote exists', async () => {
  const raw: CsfloatTrade = { ...sample, buyer_id: seller, seller_id: buyer };
  await placeTrades([raw.id], 'holds');
  await savePrices([{ name: raw.contract.item.market_hash_name, priceCents: 100, fetchedAt: new Date().toISOString() }], '2000-01-01');
  const fetchPrice = vi.fn(async (path: string) => {
    if (path === '/api/v1/me') return Response.json({ user: { steam_id: seller } });
    if (path.startsWith('/api/v1/me/trades?')) return Response.json({ trades: [raw], count: 1 });
    if (path.startsWith(`/api/v1/users/${seller}/stall?`)) return Response.json([]);
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal('fetch', fetchPrice);
  await syncFromCsfloat({ openTabIfNeeded: false, forcePrices: true });
  const quote = (await loadPrices()).get(raw.contract.item.market_hash_name)!;
  expect(quote.priceCents).toBe(100);
  expect(quote.instantSell).toBeUndefined();
  expect((await loadSettings()).pricesPausedUntil).toBeUndefined();
  expect(fetchPrice).toHaveBeenCalledTimes(3);
});
