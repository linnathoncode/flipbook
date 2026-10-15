import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { buildFlip } from '../src/domain/profit';
import { buildTrackerWorkbook } from '../src/io/exportWorkbook';
import { readTrackerRows } from '../src/io/trackerWorkbook';
import { skin, sticker, trade } from './builders';

describe('buildTrackerWorkbook', () => {
  it('writes the Flips layout with formulas and a hidden metadata sheet', async () => {
    const buy = trade('buy', skin(), '2026-01-01T00:00:00Z', 765);
    const sell = trade('sell', skin(), '2026-01-05T00:00:00Z', 815);
    const openBuy = trade('buy', sticker(), '2026-02-01T00:00:00Z', 120);
    const flip = buildFlip({ sellId: sell.id, buyId: buy.id, confidence: 'exact' }, buy, sell);

    const buffer = await buildTrackerWorkbook({ flips: [flip], openBuys: [openBuy], defaultFeeRate: 0.02 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const flips = workbook.getWorksheet('Flips')!;

    expect(flips.getRow(1).getCell('C').value).toBe('Buy Date');
    expect(flips.getRow(1).getCell('L').value).toBe('Weighted Avg %');
    expect(flips.getCell('D2').value).toBe('AK-47 | Slate - MW');
    expect(flips.getCell('F2').value).toBe(8.15);
    expect(flips.getCell('G2').formula).toBe('IF(F2<>"",F2*0.02,0)');
    expect(flips.getCell('F3').value).toBeNull();
    expect(workbook.getWorksheet('_meta')!.state).toBe('hidden');
    expect(workbook.getWorksheet('_meta')!.getCell('D2').value).toBe('exact');
  });

  it('reads back what it writes', async () => {
    const buy = trade('buy', skin(), '2026-01-01T00:00:00Z', 765);
    const buffer = await buildTrackerWorkbook({ flips: [], openBuys: [buy], defaultFeeRate: 0.02 });
    const rows = await readTrackerRows(buffer);
    expect(rows).toEqual([
      { rowNumber: 2, skinName: 'AK-47 | Slate - MW', buyPrice: 7.65, sellPrice: undefined, buyDate: '2026-01-01T00:00:00.000Z' },
    ]);
  });
});

const trackerPath = resolve(__dirname, 'fixtures/cs trades.xlsx');
const describeWithTracker = existsSync(trackerPath) ? describe : describe.skip;

describeWithTracker('real tracker', () => {
  it('finds the header at C1 and reads every flip row', async () => {
    const rows = await readTrackerRows(readFileSync(trackerPath).buffer as ArrayBuffer);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]).toMatchObject({ rowNumber: 2, skinName: 'MP9 | Rose Iron - FN', buyPrice: 7.65, sellPrice: 8.15 });
    expect(rows[0].buyDate).toMatch(/^2026-/);
  });
});
