import { describe, it, expect } from 'vitest';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from './xlsx';

describe('lib/exports/xlsx', () => {
  describe('XLSX_MIME', () => {
    it('is the OpenXML spreadsheet MIME', () => {
      expect(XLSX_MIME).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });

  describe('attachmentDisposition', () => {
    it('quotes the filename', () => {
      expect(attachmentDisposition('report.xlsx')).toBe(
        'attachment; filename="report.xlsx"',
      );
    });

    it('strips characters that would break the header', () => {
      // CR, LF, double-quote, backslash all replaced with '_'.
      expect(attachmentDisposition('a"b\\c\r\nd.xlsx')).toBe(
        'attachment; filename="a_b_c__d.xlsx"',
      );
    });

    it('preserves arabic / unicode characters', () => {
      // Filenames with non-ASCII pass through unchanged \u2014 the helper does
      // not RFC5987-encode (relies on the browser fallback).
      expect(attachmentDisposition('\u062A\u0642\u0631\u064A\u0631.xlsx')).toBe(
        'attachment; filename="\u062A\u0642\u0631\u064A\u0631.xlsx"',
      );
    });
  });

  describe('buildSingleSheetXlsx', () => {
    it('returns a Blob with non-empty bytes for a small workbook', async () => {
      const blob = (await buildSingleSheetXlsx({
        name: 'Cases',
        columns: [
          { header: 'Number', key: 'caseNumber' },
          { header: 'Amount', key: 'amount', numFmt: '#,##0.000' },
        ],
        rows: [
          { caseNumber: 'REF-KW-2026-000001', amount: 50.5 },
          { caseNumber: 'REF-KW-2026-000002', amount: 75 },
        ],
      })) as Blob;

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('handles a sheet name longer than 31 chars (Excel limit)', async () => {
      // Excel rejects > 31 char sheet names. The helper must slice. We
      // can only assert that this doesn't throw \u2014 ExcelJS would otherwise.
      const blob = (await buildSingleSheetXlsx({
        name: 'A really long sheet name that definitely exceeds the 31 char Excel limit',
        columns: [{ header: 'X', key: 'x' }],
        rows: [{ x: 1 }],
      })) as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('handles an empty rows array (header-only sheet)', async () => {
      const blob = (await buildSingleSheetXlsx({
        name: 'Empty',
        columns: [{ header: 'X', key: 'x' }],
        rows: [],
      })) as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});
