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
3. Your sales show up on the **Flips** sheet, each paired with its buy.

After that, Flipbook syncs on its own whenever a CSFloat tab loads, every 30 minutes while one is open,
and when you open Flipbook. **Sync now** at the top forces a sync.

## Using it

- **Flips** shows every sale with its buy, the fee, net profit and profit %. Newest buys are on top, and trades since your last visit are tagged **New**.
- **Holding** shows what you bought and haven't sold yet.
- **Needs review** lists sales Flipbook couldn't pair on its own. Pick the right buy, or move them to a folder.
- **Folders** keep cases, long holds or gifts out of your flip totals. Select rows, then use **Move to**.
- **Selecting rows** works like a spreadsheet: click a row, Ctrl-click (Cmd on a Mac) to add more, Shift-click for a range, Escape to clear.
- **Filters** narrows by item type, period, win or loss, and how the trade was paired. Click a column header to sort.
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
- **A sale isn't paired:** it was probably bought outside CSFloat, or before your CSFloat history starts. It'll be in **Needs review**.
- **The extension shows an error in `chrome://extensions`:** run `npm run build` again and reload it.

## Your data

Flipbook reads your trades through the CSFloat tab you're already logged in to. It never sees your password and never stores a key or token.
Your journal is stored in the browser on this computer only, and nothing is sent anywhere else.

**Removing the extension deletes your journal.** Export to .xlsx first if you want to keep it.

## For developers

```sh
npm run dev        # rebuild dist/ on every change, then reload the extension
npm test
npm run typecheck
```

[PLAN.md](PLAN.md) explains how matching works and why it's built this way.
