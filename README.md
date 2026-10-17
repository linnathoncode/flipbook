# Flipbook

A Chrome extension that keeps a trade journal for your CSFloat account. It pairs each item you sold with the buy it came from,
and shows what every flip made after fees.

Everything stays in your browser. There's no account to make, no server and no API key.

## Set it up

You need [Node.js](https://nodejs.org) 20 or newer, [Git](https://git-scm.com), and Google Chrome.
Other Chromium browsers like Edge or Brave should work the same way.

1. Download and build it:

   ```sh
   git clone https://github.com/linnathoncode/flipbook.git
   cd flipbook
   npm install
   npm run build
   ```

   This creates a `dist` folder. That folder is the extension.

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `dist` folder.
5. Pin Flipbook from the puzzle-piece menu so its red icon stays in the toolbar.

## First run

1. Log in to [csfloat.com](https://csfloat.com) in the same Chrome profile.
2. Click the Flipbook icon. It opens in its own tab and starts reading your trade history from CSFloat.
   If no CSFloat tab is open, it opens one for you. Leave that tab open until the sync finishes.
3. Your trades show up on the **Flips** sheet. Each sale is paired with its buy, and anything you haven't sold yet shows as Open.

After that, Flipbook syncs on its own whenever a CSFloat tab loads, every 30 minutes while one is open,
and when you open Flipbook. **Sync now** at the top forces a sync.

## Using it

Everything you buy lands on top of **Flips**. Open buys show "Open" until they sell, then the row fills in with
the sale, the fee, net profit and profit %. Wins get a green edge and losses a red one.

Not every trade is a flip, so the sidebar has two more folders:

- **Holds** is for things you're keeping for a while. Their profit stays out of the Flips totals.
- **Other** is for anything that isn't a flip at all, like stickers you bought to apply or gifts.
  Sales with no buy on record go here on their own. You can turn that off in Settings.

To move rows, select them and use **Move to**, right-click a row, or drag rows onto a folder in the sidebar.
**+ New folder** adds your own, and moving works between any two folders.

After a move, Flipbook may offer a rule like "Always send new stickers to Holds". Rules only apply to buys made after
you create them, and anything you move by hand stays where you put it. Settings lists your rules so you can remove them.

More things you can do:

- **Select rows** like a spreadsheet: click a row, Ctrl-click (Cmd on a Mac) to add more, Shift-click for a range,
  Ctrl+A for every row in view, Escape to clear.
- **Compact / Detailed** switches the table. Detailed shows the item image, pattern seed, fade %, stickers and charms,
  and the float on a wear bar with the skin's float cap hatched out.
- **Adj. float** is where the float sits inside that skin's own range: (float − min) / (max − min). Trade-ups use this now.
- **Listed** shows in place of Open when an item is up for sale on CSFloat, with your asking price.
  Hover it to see what you'd net if it sells there. Listings refresh with every sync.
- **Worth now** on Holds prices each held item at its cheapest CSFloat listing, and **If sold now** is what that nets
  after the fee. Prices are cached: 6 hours, or 1 hour for items over $100. **Refresh prices** skips anything priced in
  the last 5 minutes, and if CSFloat rate-limits the lookups, Flipbook waits 30 minutes before asking again.
- **Filters** narrows by item type and result (open, listed, wins, losses). Right-click a filter to hide that type or
  result instead; it turns red. Click a column header to sort. Each sheet remembers its own sort.
- **Rows per page** sets the page size (25, 50, 100 or all).
- **Needs review** lists sales that could have come from more than one buy. Pick the right one and it's paired for good.
- **Analytics** charts your net profit over time, by month and by item type, with your best and worst flips.
  You can look at the last 30 days, 90 days or everything.
- **Export .xlsx** saves your Flips sheet as an Excel file with working formulas.
- **Settings** changes the seller fee (2% by default).
- The sun/moon button switches between light and dark.

### What the Match column means

| Tag | Meaning |
|---|---|
| Exact | The same skin, matched by its float and pattern |
| FIFO | Stickers, cases and other items without a float are paired oldest buy first |
| Check | Only one earlier buy has the same name. Probably right, but worth a look |
| Manual | You picked the buy in Needs review |
| Pick buy | More than one buy could be the one. Click it to choose |
| No buy | No buy on record, usually bought outside CSFloat |

## Update

```sh
git pull
npm install
npm run build
```

Then click the reload arrow on Flipbook in `chrome://extensions`. Your data is kept.

## Problems

- **Sync fails or finds nothing:** make sure you're logged in to csfloat.com in the same Chrome profile, then open a CSFloat tab and click **Sync now**.
  Any error shows at the top of Flipbook.
- **A sale isn't paired:** it was probably bought outside CSFloat, or before your CSFloat history starts. It'll be in **Other**.
  If it was a real flip, move it back to Flips.
- **No stickers or charms in Detailed view:** they come in with the next sync.
- **The extension shows an error in `chrome://extensions`:** run `npm run build` again and reload it.

## Your data

Flipbook reads your trades through the CSFloat tab you're already logged in to. It never sees your password and never stores a key or token.
Your journal is stored in the browser on this computer only, and your trades are never sent anywhere else.

Item images load from Steam's image server, the same one CSFloat uses. Steam sees which images you load, not who you are on Flipbook.

**Removing the extension deletes your journal.** Export to .xlsx first if you want to keep it.

## For developers

```sh
npm run dev        # rebuild dist/ on every change, then reload the extension
npm test
npm run typecheck
npm run float-ranges   # refresh src/domain/floatRanges.json after a CS2 update adds skins
```

[PLAN.md](PLAN.md) explains how matching works and why it's built this way.

### Releasing

The version lives in `package.json` only. The build writes it into `dist/manifest.json` and shows it in Settings.
Chrome wants plain numbers (`1.2.0`), and every upload to the Web Store needs a higher one than the last.

1. Bump it: `npm version patch --no-git-tag-version` for fixes, `minor` for new features, `major` for changes people
   have to relearn.
2. Add an entry to [CHANGELOG.md](CHANGELOG.md) and commit.
3. `npm run release` builds and writes `release/flipbook-<version>.zip`. It refuses to run with uncommitted changes.
4. Upload the zip in the Chrome Web Store dashboard, then tag the commit: `git tag v<version> && git push origin v<version>`.

Store updates install on their own and keep the journal in IndexedDB. If a release changes what's stored, raise
`DB_VERSION` in `src/io/journalStore.ts` and add an upgrade step, so existing journals carry over.

## Credits

Skin float ranges come from [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API), MIT License, Copyright (c) 2023 ByMykel.

Flipbook isn't affiliated with CSFloat or Valve.
