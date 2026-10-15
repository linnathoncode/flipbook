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
3. Flipbook opens on your **Flips** sheet: newest buys on top, totals above, and a **New** tag on trades since your last visit.
4. Select rows like in a spreadsheet: click a row, Ctrl-click (Cmd on a Mac) to add one, Shift-click for a range, Escape to clear.
   Move the selection into a **folder** to keep cases, long holds or gifts out of the book. Folders keep their own totals
   and stay out of the main book and the export.
5. **Filters** opens filters by item type, period, result and match. Click a column header to sort.
6. The tabs along the bottom switch sheets: **Flips**, **Holding**, **Needs review** (sales Flipbook couldn't pair on its own)
   and one per folder. **Export .xlsx** gives you the Flips sheet back with live formulas.
7. The sun/moon button switches between light and dark. It follows your system until you pick one.

## How matching works

| Tag | Meaning |
|---|---|
| Exact | Same skin: def index, paint index, paint seed and float all equal |
| FIFO | Stickers, cases, pins and other float-less items close oldest buy first |
| Check | Only one earlier buy has the same name. Probably right, but worth a look |
| Tracker | Paired on a row of a spreadsheet imported by an earlier version |
| Manual | You chose it in Needs review |

Asset IDs aren't used, because Steam issues a new one on every trade.

## Design

Swiss Ledger: black, white and one red, in light and dark. Heavy Archivo for headings and figures, JetBrains Mono for numbers,
thick rules instead of boxes, and spreadsheet tabs along the bottom. The only other colors are CS2's own rarity stripes,
so a glance at an item means what it does in game. The icon is a red tile with its corner folded over, like a turned ledger page.
It uses no CSFloat or Valve logos. Fonts are bundled, so the extension makes no font requests.

## Develop

```sh
npm test          # vitest
npm run typecheck
npm run dev       # rebuild dist/ on change; reload the extension in chrome://extensions
```

```
src/domain   pure logic: normalizing, matching, profit, name keys (no I/O, fully tested)
src/io       IndexedDB, CSFloat sync, Excel export
src/app      use cases the UI calls
src/ui       React dashboard
```

Tests that use a real export read `tests/fixtures/trades.json`.
Those files hold personal data, so they're gitignored, and those tests skip when the files are missing.
