import ExcelJS from 'exceljs';
import type { TrackerRow } from '../domain/trackerRows';

const FLIPS_SHEET_HINT = /flip/i;
const HEADER_SEARCH_ROWS = 10;
const REQUIRED_HEADERS = ['Skin Name', 'Buy Price'] as const;

type HeaderName = 'Skin Name' | 'Buy Price' | 'Sell Price' | 'Buy Date';

/**
 * Reads the hand-kept tracker. The header row is located by its titles rather
 * than a fixed position, since the sheet has already moved from column A to C once.
 */
export async function readTrackerRows(file: ArrayBuffer): Promise<TrackerRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);
  const sheet = findFlipsSheet(workbook);
  const header = findHeader(sheet);
  if (!header) throw new Error(`No sheet has a "${REQUIRED_HEADERS.join('" and "')}" header row.`);

  const rows: TrackerRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const read = (name: HeaderName) => {
      const column = header.columns.get(name);
      return column === undefined ? undefined : plainValue(row.getCell(column).value);
    };
    const skinName = read('Skin Name');
    const buyPrice = read('Buy Price');
    if (typeof skinName !== 'string' || !skinName.trim() || typeof buyPrice !== 'number') return;

    const sellPrice = read('Sell Price');
    const buyDate = read('Buy Date');
    rows.push({
      rowNumber,
      skinName,
      buyPrice,
      sellPrice: typeof sellPrice === 'number' ? sellPrice : undefined,
      buyDate: buyDate instanceof Date ? buyDate.toISOString() : undefined,
    });
  });
  return rows;
}

interface HeaderLocation {
  rowNumber: number;
  columns: Map<string, number>;
}

function findFlipsSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheets = workbook.worksheets;
  const byName = sheets.find((sheet) => FLIPS_SHEET_HINT.test(sheet.name));
  return byName ?? sheets.find((sheet) => findHeader(sheet)) ?? sheets[0];
}

function findHeader(sheet: ExcelJS.Worksheet): HeaderLocation | undefined {
  for (let rowNumber = 1; rowNumber <= HEADER_SEARCH_ROWS; rowNumber++) {
    const columns = new Map<string, number>();
    sheet.getRow(rowNumber).eachCell((cell, column) => {
      const text = plainValue(cell.value);
      if (typeof text === 'string') columns.set(text.trim(), column);
    });
    if (REQUIRED_HEADERS.every((name) => columns.has(name))) return { rowNumber, columns };
  }
  return undefined;
}

/** Unwraps formula results and rich text into the value a reader would see. */
function plainValue(value: ExcelJS.CellValue): string | number | Date | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return value;
  if (typeof value === 'object' && 'result' in value) return plainValue(value.result as ExcelJS.CellValue);
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((part) => part.text).join('');
  return undefined;
}
