# Flipbook

A CS2 trade journal for CSFloat. A Chrome extension that pairs your buys with your sells and shows what each flip made.
Everything is stored locally in the browser (IndexedDB). There is no backend and no API key.

See [PLAN.md](PLAN.md) for the design and why it differs from the first draft.

## Use it

```sh
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `dist/`.
Click the Flipbook icon in the toolbar to open it.

1. Log in to csfloat.com in the same browser.
2. Open or refresh a CSFloat tab. Flipbook syncs your full trade history through your session on its own:
   whenever a CSFloat tab loads, every 30 minutes while one is open, and when you open Flipbook with data older than 10 minutes.
   **Sync now** in the header forces one.
3. Optional: import your existing `cs trades.xlsx` (**Import, export & fees**) to bring in rows bought or sold elsewhere.
4. Check **Needs review** for sales Flipbook couldn't pair on its own.
5. Keep the book about flips: tick rows (shift-click for a range) and move cases, long holds or gifts into a **folder**.
   Folders keep their own totals and stay out of the main book and the export.
6. Filter by item type, period, result and match; sort by any column; switch between **Ledger**, **Compact** and **Sheet** layouts.
7. **Download .xlsx** gives you the Flips sheet back with live formulas.

## How matching works

| Tag | Meaning |
|---|---|
| Exact | Same skin: def index, paint index, paint seed and float all equal |
| FIFO | Stickers, cases, pins and other float-less items close oldest buy first |
| Check | Only one earlier buy has the same name. Probably right, but worth a look |
| Tracker | Paired on a row of your imported spreadsheet |
| Manual | You chose it in Needs review |

Asset IDs aren't used, because Steam issues a new one on every trade.

## Design

Familiar to anyone who trades on CSFloat: dark slate surfaces, CS2's own rarity colors as a stripe on every item, and float wear bars.
Flipbook's own: a gunmetal and brass palette with warm bone text, Chakra Petch for display type with IBM Plex for body and numbers,
and the page fold, the slanted crease between each flip's bought and sold halves, which the icon repeats.
It uses no CSFloat or Valve logos. Fonts are bundled, so the extension makes no font requests.

## Develop

```sh
npm test          # vitest
npm run typecheck
npm run dev       # rebuild dist/ on change; reload the extension in chrome://extensions
```

```
src/domain   pure logic: normalizing, matching, profit, name keys (no I/O, fully tested)
src/io       IndexedDB, CSFloat sync, Excel read/write
src/app      use cases the UI calls
src/ui       React dashboard
```

Tests that use real exports read `tests/fixtures/trades.json` and `tests/fixtures/cs trades.xlsx`.
Those files hold personal data, so they're gitignored, and those tests skip when the files are missing.
