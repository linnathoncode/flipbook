import ExcelJS from 'exceljs';
import { trackerDisplayName } from '../domain/itemNames';
import { centsToDollars, type Flip } from '../domain/profit';
import type { Trade } from '../domain/types';

/** Column layout of the existing Flips sheet, so exported files drop into the same workflow. */
const FLIPS_COLUMNS = [
  { header: 'Buy Date', key: 'buyDate', width: 14, numFmt: 'yyyy-mm-dd' },
  { header: 'Skin Name', key: 'skinName', width: 38 },
  { header: 'Buy Price', key: 'buyPrice', width: 12, numFmt: '$#,##0.00' },
  { header: 'Sell Price', key: 'sellPrice', width: 12, numFmt: '$#,##0.00' },
  { header: 'Total Fees', key: 'fee', width: 12, numFmt: '$#,##0.000' },
  { header: 'Net Profit', key: 'netProfit', width: 12, numFmt: '$#,##0.000' },
  { header: 'Profit Percentage', key: 'profitPercent', width: 18, numFmt: '0.0' },
] as const;
const FIRST_COLUMN = 3; // C, as in the tracker
const SUMMARY_HEADERS = ['Total Profit', 'Avg %', 'Weighted Avg %'];

const META_COLUMNS = ['Row', 'Buy Trade ID', 'Sell Trade ID', 'Match', 'Market Hash Name', 'Float', 'Paint Seed', 'Paint Index', 'Fee Rate'];

export interface ExportInput {
  flips: Flip[];
  openBuys: Trade[];
  defaultFeeRate: number;
}

export async function buildTrackerWorkbook({ flips, openBuys, defaultFeeRate }: ExportInput): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const flipsSheet = workbook.addWorksheet('Flips', { views: [{ state: 'frozen', ySplit: 1 }] });
  const metaSheet = workbook.addWorksheet('_meta', { state: 'hidden' });

  writeHeader(flipsSheet);
  metaSheet.addRow(META_COLUMNS);

  const rows = [
    ...flips.map((flip) => ({ buy: flip.buy, sell: flip.sell, flip })),
    ...openBuys.map((buy) => ({ buy, sell: undefined, flip: undefined })),
  ].sort((a, b) => a.buy.at.localeCompare(b.buy.at));

  rows.forEach(({ buy, sell, flip }, index) => {
    const rowNumber = index + 2;
    const feeRate = sell?.feeRate ?? defaultFeeRate;
    writeFlipRow(flipsSheet, rowNumber, buy, sell, feeRate);
    metaSheet.addRow([
      rowNumber,
      buy.id,
      sell?.id ?? '',
      flip?.match.confidence ?? 'open',
      buy.item.marketHashName,
      buy.item.floatValue ?? '',
      buy.item.paintSeed ?? '',
      buy.item.paintIndex ?? '',
      feeRate,
    ]);
  });
  writeSummary(flipsSheet);

  return workbook.xlsx.writeBuffer();
}

function writeHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  [...FLIPS_COLUMNS.map((column) => column.header), ...SUMMARY_HEADERS].forEach((title, offset) => {
    const cell = header.getCell(FIRST_COLUMN + offset);
    cell.value = title;
    cell.font = { bold: true };
  });
  FLIPS_COLUMNS.forEach((column, offset) => {
    sheet.getColumn(FIRST_COLUMN + offset).width = column.width;
  });
}

function writeFlipRow(sheet: ExcelJS.Worksheet, rowNumber: number, buy: Trade, sell: Trade | undefined, feeRate: number) {
  const [date, name, buyPrice, sellPrice, fee, net, percent] = FLIPS_COLUMNS.map((_, offset) =>
    sheet.getCell(rowNumber, FIRST_COLUMN + offset),
  );
  const ref = (cell: ExcelJS.Cell) => cell.address;

  date.value = new Date(buy.at);
  name.value = buy.source === 'xlsx' ? buy.item.itemName : trackerDisplayName(buy.item);
  buyPrice.value = centsToDollars(buy.priceCents);
  sellPrice.value = sell ? centsToDollars(sell.priceCents) : null;
  // Same formulas as the hand-kept sheet, so edits in Excel keep recalculating.
  fee.value = { formula: `IF(${ref(sellPrice)}<>"",${ref(sellPrice)}*${feeRate},0)` };
  net.value = { formula: `IF(${ref(sellPrice)}<>"",${ref(sellPrice)}-${ref(buyPrice)}-${ref(fee)},0)` };
  percent.value = {
    formula: `IF(${ref(sellPrice)}<>"",ROUND((${ref(sellPrice)}-${ref(buyPrice)}-${ref(fee)})/${ref(buyPrice)}*100,1),"")`,
  };

  FLIPS_COLUMNS.forEach((column, offset) => {
    if ('numFmt' in column) sheet.getCell(rowNumber, FIRST_COLUMN + offset).numFmt = column.numFmt;
  });
}

function writeSummary(sheet: ExcelJS.Worksheet) {
  const column = (offset: number) => sheet.getColumn(FIRST_COLUMN + offset).letter;
  const [buyPrice, net, percent] = [column(2), column(5), column(6)];
  const summaryRow = sheet.getRow(2);
  const summaryStart = FIRST_COLUMN + FLIPS_COLUMNS.length;

  summaryRow.getCell(summaryStart).value = { formula: `SUM(${net}:${net})` };
  summaryRow.getCell(summaryStart + 1).value = { formula: `ROUND(AVERAGE(${percent}:${percent}),1)` };
  summaryRow.getCell(summaryStart + 2).value = {
    formula: `SUMPRODUCT(${percent}:${percent},${buyPrice}:${buyPrice})/SUMIF(${percent}:${percent},"<>",${buyPrice}:${buyPrice})`,
  };
  summaryRow.getCell(summaryStart).numFmt = '$#,##0.00';
  summaryRow.getCell(summaryStart + 1).numFmt = '0.0';
  summaryRow.getCell(summaryStart + 2).numFmt = '0.0';
}
