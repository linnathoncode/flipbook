import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  detectOwnerSteamId,
  normalizeCsfloatTrades,
  type CsfloatTradesPage,
} from '../src/domain/csfloatTrades';
import { matchTrades } from '../src/domain/matcher';

// The real export holds personal data and is gitignored; these tests run only when it's present locally.
const fixturePath = resolve(__dirname, 'fixtures/trades.json');
const describeWithFixture = existsSync(fixturePath) ? describe : describe.skip;

describeWithFixture('real CSFloat export', () => {
  const page = () => JSON.parse(readFileSync(fixturePath, 'utf-8')) as CsfloatTradesPage;

  it('detects the account owner', () => {
    expect(detectOwnerSteamId(page().trades)).toMatch(/^7656119\d{10}$/);
  });

  it('keeps verified and pending trades only', () => {
    const { trades: raw } = page();
    const trades = normalizeCsfloatTrades(raw, detectOwnerSteamId(raw)!);
    expect(trades).toHaveLength(177);
    expect(trades.every((trade) => Number.isInteger(trade.priceCents))).toBe(true);
  });

  it('matches every sold skin that was bought inside the export window', () => {
    const { trades: raw } = page();
    const result = matchTrades(normalizeCsfloatTrades(raw, detectOwnerSteamId(raw)!));
    const exact = result.matches.filter((match) => match.confidence === 'exact');
    expect(exact.length).toBeGreaterThanOrEqual(35);
  });
});
