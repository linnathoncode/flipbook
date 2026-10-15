# CSFloat Trade Journal

Chrome extension that pairs your CSFloat buys with your sells and shows what each flip made.
Everything is stored locally in the browser (IndexedDB). There is no backend and no API key.

See [PLAN.md](PLAN.md) for the design and why it differs from the first draft.

## Use it

```sh
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `dist/`.
Click the toolbar icon to open the dashboard.

1. Log in to csfloat.com in the same browser.
2. **Import → Sync trades**. This pulls your full trade history through your session.
3. Optional: import your existing `cs trades.xlsx` to bring in rows bought or sold elsewhere.
4. Check **Review** for sells the matcher couldn't pair on its own.
5. **Import → Download .xlsx** gives you the Flips sheet back with live formulas.

## How matching works

| Badge | Meaning |
|---|---|
| exact | Same skin: def index, paint index, paint seed and float all equal |
| FIFO | Stickers, cases, pins and other float-less items close oldest buy first |
| check | Only one earlier buy has the same name. Probably right, but worth a look |
| tracker | Paired on a row of your imported spreadsheet |
| manual | You chose it in Review |

Asset IDs aren't used, because Steam issues a new one on every trade.

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
