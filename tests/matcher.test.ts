import { matchTrades } from '../src/domain/matcher';
import { skin, sticker, trade } from './builders';

describe('matchTrades', () => {
  it('matches a sold skin to the buy with the same fingerprint', () => {
    const buy = trade('buy', skin(), '2026-01-01');
    const otherBuy = trade('buy', skin({ floatValue: 0.2 }), '2026-01-02');
    const sell = trade('sell', skin(), '2026-01-05');

    const result = matchTrades([sell, buy, otherBuy]);

    expect(result.matches).toEqual([{ sellId: sell.id, buyId: buy.id, confidence: 'exact' }]);
    expect(result.openBuyIds).toEqual([otherBuy.id]);
  });

  it('pairs a re-bought skin with the latest buy before each sell', () => {
    const firstBuy = trade('buy', skin(), '2026-01-01');
    const firstSell = trade('sell', skin(), '2026-01-03');
    const secondBuy = trade('buy', skin(), '2026-02-01');
    const secondSell = trade('sell', skin(), '2026-02-03');

    const { matches } = matchTrades([secondSell, firstSell, secondBuy, firstBuy]);

    expect(matches).toContainEqual({ sellId: firstSell.id, buyId: firstBuy.id, confidence: 'exact' });
    expect(matches).toContainEqual({ sellId: secondSell.id, buyId: secondBuy.id, confidence: 'exact' });
  });

  it('never matches a buy made after the sell', () => {
    const sell = trade('sell', skin(), '2026-01-01');
    const laterBuy = trade('buy', skin(), '2026-01-02');

    const result = matchTrades([sell, laterBuy]);

    expect(result.matches).toEqual([]);
    expect(result.unmatchedSells).toEqual([{ sellId: sell.id, reason: 'no-candidate', candidateBuyIds: [] }]);
  });

  it('closes commodities first-in-first-out', () => {
    const oldest = trade('buy', sticker(), '2026-01-01');
    const newer = trade('buy', sticker(), '2026-01-02');
    const sell = trade('sell', sticker(), '2026-01-03');

    const result = matchTrades([newer, sell, oldest]);

    expect(result.matches).toEqual([{ sellId: sell.id, buyId: oldest.id, confidence: 'fifo' }]);
    expect(result.openBuyIds).toEqual([newer.id]);
  });

  it('suggests a single same-name buy when the skin has no fingerprint match', () => {
    const buy = trade('buy', skin({ floatValue: undefined, defIndex: undefined }), '2026-01-01');
    const sell = trade('sell', skin(), '2026-01-02');

    const { matches } = matchTrades([buy, sell]);

    expect(matches).toEqual([{ sellId: sell.id, buyId: buy.id, confidence: 'suggested' }]);
  });

  it('flags a sell as ambiguous when several same-name buys could fit', () => {
    const buyA = trade('buy', skin({ floatValue: 0.3 }), '2026-01-01');
    const buyB = trade('buy', skin({ floatValue: 0.4 }), '2026-01-02');
    const sell = trade('sell', skin({ floatValue: 0.5 }), '2026-01-03');

    const result = matchTrades([buyA, buyB, sell]);

    expect(result.unmatchedSells).toEqual([
      { sellId: sell.id, reason: 'ambiguous', candidateBuyIds: [buyA.id, buyB.id] },
    ]);
  });

  it('keeps locked matches and does not reuse their buys', () => {
    const buyA = trade('buy', sticker(), '2026-01-01');
    const buyB = trade('buy', sticker(), '2026-01-02');
    const sell = trade('sell', sticker(), '2026-01-03');
    const locked = { sellId: sell.id, buyId: buyB.id, confidence: 'manual' as const };

    const result = matchTrades([buyA, buyB, sell], [locked]);

    expect(result.matches).toEqual([locked]);
    expect(result.openBuyIds).toEqual([buyA.id]);
  });

  it('ignores locked matches that point at trades no longer present', () => {
    const sell = trade('sell', sticker(), '2026-01-03');
    const result = matchTrades([sell], [{ sellId: sell.id, buyId: 'gone', confidence: 'manual' }]);
    expect(result.matches).toEqual([]);
  });

  it('is deterministic regardless of input order', () => {
    const trades = [
      trade('buy', sticker(), '2026-01-01'),
      trade('buy', sticker(), '2026-01-01'),
      trade('sell', sticker(), '2026-01-02'),
    ];
    expect(matchTrades([...trades].reverse())).toEqual(matchTrades(trades));
  });
});
