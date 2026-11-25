import { analyze, monthsBetween } from '../src/domain/analytics';
import { buildFlip, type Flip } from '../src/domain/profit';
import { skin, sticker, trade } from './builders';

const NOW = new Date('2026-10-15T12:00:00Z');

function flip(boughtAt: string, soldAt: string, buyCents: number, sellCents: number, item = skin()): Flip {
  const buy = trade('buy', item, boughtAt, buyCents);
  const sell = trade('sell', item, soldAt, sellCents);
  return buildFlip({ sellId: sell.id, buyId: buy.id, confidence: 'exact' }, buy, sell, 0);
}

describe('analyze', () => {
  const win = flip('2026-09-01T00:00:00Z', '2026-09-11T00:00:00Z', 1000, 1500);
  const loss = flip('2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z', 1000, 800, sticker());
  const old = flip('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', 1000, 1100);
  const open = trade('buy', skin(), '2026-10-10T00:00:00Z', 2500);

  it('counts flips sold inside the period', () => {
    const data = analyze([win, loss, old], [open], '90d', NOW);
    expect(data.closed).toEqual([win, loss]);
    expect(data.net).toBeCloseTo(3);
    expect(data.winRate).toBe(0.5);
    expect(data.averageHeldDays).toBe(7);
    expect(data.openCost).toBe(25);
  });

  it('weights the realized return by cost and groups net profit by hold time', () => {
    const biggerLoss = flip('2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z', 2000, 1700, sticker());
    const data = analyze([win, biggerLoss], [open], '90d', NOW);
    expect(data.closedCost).toBe(30);
    expect(data.proceeds).toBe(32);
    expect(data.weightedReturn).toBeCloseTo(100 * 2 / 30);
    expect(data.outcomes).toEqual({ profitable: 1, flops: 1, even: 0, gains: 5, losses: -3 });
    expect(data.topThreeGainShare).toBe(1);
    expect(data.medianHeldDays).toBe(7);
    expect(data.byHold.slice(0, 2)).toEqual([
      { label: '0-7 days', count: 1, net: -3, sellIds: [biggerLoss.sell.id] },
      { label: '8-30 days', count: 1, net: 5, sellIds: [win.sell.id] },
    ]);
  });

  it('keeps a running total in sale order', () => {
    const data = analyze([loss, win], [], '90d', NOW);
    expect(data.cumulative.map((point) => point.total)).toEqual([5, 3]);
  });

  it('charts every month from the first sale, including empty ones', () => {
    const data = analyze([win, loss, old], [], 'all', NOW);
    expect(data.byMonth.map((month) => month.month)).toEqual(monthsBetween('2026-02-01', '2026-10-15'));
    expect(data.byMonth.find((month) => month.month === '2026-05')!.net).toBe(0);
    expect(data.byMonth.find((month) => month.month === '2026-05')!.sellIds).toEqual([]);
    expect(data.byMonth.find((month) => month.month === '2026-09')!.sellIds).toEqual([win.sell.id]);
  });

  it('groups by kind and ranks best and worst', () => {
    const data = analyze([win, loss], [], '90d', NOW);
    expect(data.byKind.map((group) => group.kind)).toEqual(['rifle', 'sticker']);
    expect(data.byKind.map((group) => group.sellIds)).toEqual([[win.sell.id], [loss.sell.id]]);
    expect(data.best).toEqual([win]);
    expect(data.worst).toEqual([loss]);
  });
});

describe('monthsBetween', () => {
  it('crosses year ends', () => {
    expect(monthsBetween('2025-11-20', '2026-01-02')).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});
