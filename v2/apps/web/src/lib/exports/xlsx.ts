import ExcelJS from 'exceljs';

interface SheetSpec<Row> {
  name: string;
  columns: ReadonlyArray<{
    header: string;
    key: keyof Row & string;
    width?: number;
    /** Optional Excel number format string, e.g. `'#,##0.000'`. */
    numFmt?: string;
  }>;
  rows: ReadonlyArray<Row>;
}

/**
 * Build an .xlsx workbook in-memory with a single sheet and return its bytes.
 *
 * The first row is styled as a header (bold, light fill, frozen). Numeric and
 * date cells are formatted via `numFmt` when provided. Suitable for typical
 * report sizes (≤ 50k rows); for very large exports use a streaming writer.
 */
export async function buildSingleSheetXlsx<Row extends object>(
  spec: SheetSpec<Row>,
): Promise<BodyInit> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WOW Refund Platform';
  wb.created = new Date();
  const sheet = wb.addWorksheet(spec.name.slice(0, 31));

  sheet.columns = spec.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(12, c.header.length + 2),
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF3F8' },
  };
  headerRow.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of spec.rows) {
    sheet.addRow(row);
  }

  const buf = await wb.xlsx.writeBuffer();
  // exceljs returns ExcelJS.Buffer (a Buffer alias); coerce to a Blob so the
  // value is a portable BodyInit that satisfies both Node and Web fetch types
  // without depending on Buffer-vs-Uint8Array overload quirks.
  return new Blob([Buffer.from(buf as ArrayBuffer)]);
}

/** Build a Content-Disposition value with a filename suitable for browsers. */
export function attachmentDisposition(filename: string): string {
  const safe = filename.replace(/[\r\n"\\]/g, '_');
  return `attachment; filename="${safe}"`;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
