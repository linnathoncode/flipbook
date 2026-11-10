# Flipbook — Plan (v2)

Reworks the original `cs-trade-journal-project.md` after checking it against real data
(a `trades.json` export; `cs trades.xlsx`, Flips sheet).

## What changed from v1, and why

| v1 assumption | What the data shows | v2 decision |
|---|---|---|
| Match by `asset_id` / inspect link ("Exact" tier) | No sell shares an `asset_id` with any buy — Steam reissues asset IDs on every trade, and inspect links embed the asset ID | Drop that tier. The identity of a skin is its **fingerprint**: `def_index + paint_index + paint_seed + float_value`. Most sold skins matched a buy this way; the rest were bought before the export window or off-CSFloat |
| Capture sells by scraping CSFloat sell pages | `/me/trades` already returns both sides with price, item, state | **Sync** from CSFloat's own API using the user's logged-in session (request runs inside a csfloat.com tab, so the browser attaches the session cookie — no API key is ever read or stored). DOM scraping dropped |
| One `trades.json` import is the source | Export reports a `count` higher than the trades it contains → older buys missing (this is why the earlier CSV needed `fallback_oldest_json_date`) | Sync paginates until `count` is reached. No file import |
| Items without float are edge cases | Many buys are stickers; cases/pins/patches/music kits also lack float | Non-float items are **commodities**: matched FIFO by `market_hash_name` |
| Tracker columns: Skin Name, Buy Price, … | Flips sheet now: `Buy Date, Skin Name, Buy Price, Sell Price, Total Fees, Net Profit, Profit Percentage` at C1, summary `Total Profit, Avg %, Weighted Avg %` at J1:L2 | Export follows the actual layout |
| Exact matching on IDs | Prices are integer **cents**; `state` ∈ verified/pending/cancelled/failed | Store cents internally. Count `verified` as closed, show `pending` separately, skip `cancelled`/`failed` |

## Scope (MVP)

A Chrome MV3 extension with a dashboard tab. All data stays in IndexedDB on the machine.
It answers one question well: *what did I pay for each item I sold, and what did I make?*

Not in scope: trade-ups. Not in MVP: price checking, external pricing APIs, deposit/withdraw fee allocation, multi-account.

## Architecture

```
manifest.json (MV3)
├── background.js        opens dashboard on toolbar click
└── dashboard.html       React app
    ├── sync             chrome.scripting.executeScript into a csfloat.com tab
    │                    → fetch('/api/v1/me/trades?page=N&limit=…', {credentials:'include'})
    ├── domain           pure TS: normalize → positions → matcher → P&L
    ├── db               IndexedDB (idb): trades, manualTrades, matchOverrides, settings
    └── export           ExcelJS → Flips / _meta (hidden)
```

Permissions: `storage`, `scripting`, `tabs`, host `https://csfloat.com/*`.

## Data model

- `Trade` — one normalized buy or sell. `id` = CSFloat trade id (or `manual:<uuid>` / `xlsx:<row>`).
  Fields: side, state, priceCents, at (ISO), source, item {marketHashName, itemName, wearName, type,
  defIndex, paintIndex, paintSeed, floatValue, isStatTrak, isSouvenir, iconUrl, inspect}.
- `Match` — `{sellId, buyId, confidence, method, locked}`. `locked` = user decided; never overwritten by auto-match.
- `Settings`: `steamId`, `feeRate` (default 0.02), folder `rules`, `orphansToOther`.
- `Folder` + `Placement`: user folders and trade id → folder id.

Side is derived from `buyer_id`/`seller_id` vs the signed-in user's Steam ID from `/api/v1/me`.

## Matching

Run on every sync; deterministic and idempotent.

1. Apply locked (manual) matches first.
2. **Fingerprint** (float items): exact `defIndex+paintIndex+paintSeed+float` → confidence `exact`.
   Must be bought before sold; if several open buys share the fingerprint (bought, sold, re-bought), take the latest buy before the sell.
3. **Commodity FIFO** (no float): oldest open buy with same `marketHashName` bought before the sell → `fifo`.
4. **Name only** (float items with no fingerprint hit, e.g. Excel rows without float): single open candidate with same name → `suggested` (shown for review, not counted as confirmed); multiple → `ambiguous`.
5. Everything else → sell stays `unmatched` and visible.

## P&L

```
fee       = sellPrice × feeRate        (feeRate default 0.02, overridable per trade)
netProfit = sellPrice − buyPrice − fee
profit %  = netProfit / buyPrice × 100
weighted% = Σ(profit% × buyPrice) / Σ buyPrice
```

Same formulas as the Flips sheet so exported numbers reconcile with Excel.

## Excel

- **Import** was dropped: there's no telling how other people keep their spreadsheets.
  Rows imported by earlier versions stay in the book (source `xlsx`, match `tracker`).
- **Export**: `Flips` sheet with live formulas at the same columns (C:L), hidden `_meta` sheet with trade IDs, float, seed, match confidence.

## Dashboard screens

A sidebar lists the sheets with their row counts; each sheet's table scrolls in its own container under a header
with the figures for that sheet, sync status, **Sync now** and the light/dark toggle. **Export .xlsx** and **Settings** sit at the foot.

1. **Flips** (opens first): every buy, newest on top. Open buys and closed flips share one table, so a new buy is
   always the first row. Trades since the last visit carry a **New** tag.
2. **Holds** and **Other**: default folders that can't be renamed or deleted. Holds is for long holds, Other for
   trades that aren't flips. User folders follow. Folders are excluded from the Flips totals and the export.
3. **Needs review**: ambiguous sales across the whole journal, with the net each candidate buy would give.
4. **Analytics**: cumulative net, net by month, net by item kind, best and worst five; 30 days, 90 days or all.
5. **Settings**: sync, seller fee, auto-Other for sales with no buy, folder rules.

Every sheet: search, a **Filters** row (item kind, result) that stays closed until asked for, sortable columns,
pagination (25/50/100/all), and spreadsheet selection that swaps the toolbar for **Move to**. Rows also move by
right-click menu or by dragging onto a sidebar folder. Sort, page size, Compact/Detailed and theme are remembered per browser.

### Where a trade goes

Placement is a map of trade id → folder id, with the sentinel `flips` pinning a trade to the Flips sheet. In order:

1. Where the user put it.
2. A folder rule (`{kind, folderId, since}`) for buys made on or after `since`. After a move where every row is the
   same kind, a toast offers the rule. Rules never touch older trades, which is why the same journal works for someone
   who flips stickers and someone who only buys them to apply.
3. Sales with no buy candidate go to Other (setting, on by default).
4. Everything else stays on Flips.

A flip follows its sell's folder, else its buy's.

### Item detail

Kinds come from the weapon def index (pistol, rifle, sniper, SMG, heavy), ★ for knives and gloves, and CSFloat's
`type` for the rest. Detailed view adds the Steam image, seed, fade %, stickers and charms, and the wear bar.
Float caps come from a bundled table keyed `defIndex:paintIndex` (built by `npm run float-ranges` from
ByMykel/CSGO-API, MIT); skins missing from it count as 0 to 1. Adjusted float = (float − min) / (max − min), which is
what trade-ups use.

Look: warm stone paper (#fbfaf7 light / #171613 dark), ink as the only accent, green and red only for money,
CS2 rarity colors on items. Schibsted Grotesk + Martian Mono, hairline rules, 7px corners. No uppercase labels,
pills, icons on menu rows or status dots.

## Sync

The background worker syncs through an already-open csfloat.com tab when one finishes loading and on a 30-minute alarm;
the dashboard asks for a sync on open when the last one is over 10 minutes old (opening a CSFloat tab if needed).
One sync runs at a time. Failures are stored and shown in the header.

## Milestones

1. Scaffold (Vite + React + TS, MV3 manifest, vitest). ✅ target this session
2. Domain: normalize `trades.json`, matcher, P&L — tests on the real export.
3. IndexedDB store + import screen.
4. Sync from CSFloat session (paginated).
5. Excel export (import was built, then dropped).
6. Review UI for manual matches.
7. Polish: manual trade entry (sales on other markets with their own fee).

## Tests

- Parser: real `trades.json` → verified and pending kept, cancelled/failed dropped; cents preserved; missing float ok.
- Matcher: fingerprint match; re-bought item takes latest prior buy; commodity FIFO; buy-after-sell never matches; locked match survives rerun; idempotent.
- P&L: matches Flips sheet row 2 (7.65 → 8.15 ⇒ fee 0.163, net 0.337, 4.4%).
- Excel: name normalizer cases from the existing CSV; export formulas present.

## Open questions

- CSFloat `limit` cap per page is unverified (the export stopped short of `count`); sync pages until `count` reached or a page comes back empty.
- Sales on other markets (Steam, Buff) need manual entry with their own fee — milestone 7.
