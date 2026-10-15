import { buildFlip, summarize } from '../src/domain/profit';
import { sticker, trade } from './builders';

describe('profit', () => {
  // Row 2 of the existing Flips sheet: 7.65 → 8.15 gives fee 0.163, net 0.337, 4.4%.
  const flipFromSheet = () => {
    const buy = trade('buy', sticker(), '2026-01-01', 765);
    const sell = trade('sell', sticker(), '2026-01-02', 815);
    return buildFlip({ sellId: sell.id, buyId: buy.id, confidence: 'fifo' }, buy, sell);
  };

  it('reproduces the tracker formulas', () => {
    const flip = flipFromSheet();
    expect(flip.fee).toBeCloseTo(0.163);
    expect(flip.netProfit).toBeCloseTo(0.337);
    expect(flip.profitPercent).toBeCloseTo(4.405, 2);
  });

  it('uses a per-trade fee rate when the sell has one', () => {
    const buy = trade('buy', sticker(), '2026-01-01', 1000);
    const sell = { ...trade('sell', sticker(), '2026-01-02', 2000), feeRate: 0.15 };
    const flip = buildFlip({ sellId: sell.id, buyId: buy.id, confidence: 'manual' }, buy, sell);
    expect(flip.fee).toBeCloseTo(3);
  });

  it('weights the average by buy price', () => {
    const cheapBuy = trade('buy', sticker(), '2026-01-01', 100);
    const cheapSell = trade('sell', sticker(), '2026-01-02', 200);
    const bigBuy = trade('buy', sticker(), '2026-01-01', 10000);
    const bigSell = trade('sell', sticker(), '2026-01-02', 10000);
    const flips = [
      buildFlip({ sellId: cheapSell.id, buyId: cheapBuy.id, confidence: 'fifo' }, cheapBuy, cheapSell, 0),
      buildFlip({ sellId: bigSell.id, buyId: bigBuy.id, confidence: 'fifo' }, bigBuy, bigSell, 0),
    ];

    const summary = summarize(flips);

    expect(summary.averagePercent).toBeCloseTo(50);
    expect(summary.weightedAveragePercent).toBeCloseTo(100 / 101, 3);
    expect(summary.totalProfit).toBeCloseTo(1);
  });

  it('returns zeros for no flips', () => {
    expect(summarize([])).toEqual({ flipCount: 0, totalProfit: 0, averagePercent: 0, weightedAveragePercent: 0 });
  });
});
