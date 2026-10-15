import { reconcileTrackerRows } from '../src/domain/trackerRows';
import { skin, trade } from './builders';

const slateMW = skin();

describe('reconcileTrackerRows', () => {
  it('links a row to the CSFloat buy and sell with the same name and price', () => {
    const buy = trade('buy', slateMW, '2026-01-01T10:00:00Z', 765);
    const sell = trade('sell', slateMW, '2026-01-09T10:00:00Z', 815);
    const row = { rowNumber: 2, skinName: 'AK-47 | Slate - MW', buyPrice: 7.65, sellPrice: 8.15 };

    const result = reconcileTrackerRows([row], [buy, sell]);

    expect(result.newTrades).toEqual([]);
    expect(result.lockedMatches).toEqual([{ sellId: sell.id, buyId: buy.id, confidence: 'tracker' }]);
  });

  it('prefers the buy closest to the row date when prices repeat', () => {
    const early = trade('buy', slateMW, '2025-06-01T00:00:00Z', 500);
    const late = trade('buy', slateMW, '2026-03-01T00:00:00Z', 500);
    const row = { rowNumber: 2, skinName: 'AK-47 | Slate - MW', buyPrice: 5, sellPrice: 6, buyDate: '2026-02-28T00:00:00Z' };

    const { lockedMatches } = reconcileTrackerRows([row], [early, late]);

    expect(lockedMatches).toEqual([{ sellId: 'xlsx:2:sell', buyId: late.id, confidence: 'tracker' }]);
  });

  it('links a buy on the same day even when the typed price is a few cents off', () => {
    const buy = trade('buy', slateMW, '2026-06-25T09:00:00Z', 355);
    const row = { rowNumber: 15, skinName: 'AK-47 | Slate - MW', buyPrice: 3.53, buyDate: '2026-06-25T00:00:00Z' };

    expect(reconcileTrackerRows([row], [buy]).newTrades).toEqual([]);
  });

  it('creates stand-in trades for rows with no CSFloat counterpart', () => {
    const row = { rowNumber: 7, skinName: 'Italy Pin', buyPrice: 3.1, sellPrice: 4, buyDate: '2025-07-01T00:00:00Z' };

    const { newTrades, lockedMatches } = reconcileTrackerRows([row], []);

    expect(newTrades.map((t) => [t.id, t.side, t.priceCents, t.at])).toEqual([
      ['xlsx:7:buy', 'buy', 310, '2025-07-01T00:00:00Z'],
      ['xlsx:7:sell', 'sell', 400, '2025-07-01T00:00:00Z'],
    ]);
    expect(lockedMatches).toEqual([{ sellId: 'xlsx:7:sell', buyId: 'xlsx:7:buy', confidence: 'tracker' }]);
  });

  it('never links one CSFloat trade to two rows', () => {
    const buy = trade('buy', slateMW, '2026-01-01', 500);
    const row = { rowNumber: 2, skinName: 'AK-47 | Slate - MW', buyPrice: 5 };

    const { newTrades } = reconcileTrackerRows([row, { ...row, rowNumber: 3 }], [buy]);

    expect(newTrades.map((t) => t.id)).toEqual(['xlsx:3:buy']);
  });
});
