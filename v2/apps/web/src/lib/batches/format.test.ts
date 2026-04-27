import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  renderCasesTable,
  renderKnetComponentsTable,
  renderAuraOrdersTable,
} from './format';

describe('lib/batches/format', () => {
  describe('formatMoney', () => {
    it('renders amount.toFixed(2) + currency code (locale-agnostic)', () => {
      expect(formatMoney(1234, 'KWD')).toBe('1234.00 KWD');
      expect(formatMoney(0.1 + 0.2, 'USD')).toBe('0.30 USD');
      expect(formatMoney(99.999, 'EUR')).toBe('100.00 EUR');
      expect(formatMoney(0, 'SAR')).toBe('0.00 SAR');
    });
  });

  describe('renderCasesTable', () => {
    it('returns "(none)" for empty rows', () => {
      expect(renderCasesTable([])).toBe('(none)');
    });

    it('numbers rows with right-aligned 2-char index', () => {
      const out = renderCasesTable([
        {
          caseNumber: 'REF-KW-2026-000001',
          customerName: 'Alice',
          orderNumber: 'O-100',
          brandName: 'Acme',
          paymentLabel: 'KNET',
          refundAmount: 50,
          currency: 'KWD',
        },
        {
          caseNumber: 'REF-KW-2026-000002',
          customerName: 'Bob',
          orderNumber: 'O-101',
          brandName: 'Acme',
          paymentLabel: 'KNET',
          refundAmount: 75,
          currency: 'KWD',
        },
      ]);
      const lines = out.split('\n');
      expect(lines).toHaveLength(2);
      // Indices padded to width 2: ' 1' / ' 2'
      expect(lines[0]).toMatch(/^ 1\. REF-KW-2026-000001 {2}Alice/);
      expect(lines[1]).toMatch(/^ 2\. REF-KW-2026-000002 {2}Bob/);
      expect(lines[0]).toContain('50.00 KWD');
    });
  });

  describe('renderKnetComponentsTable', () => {
    it('returns "(none)" for empty rows', () => {
      expect(renderKnetComponentsTable([])).toBe('(none)');
    });

    it('renders auth code with em-dash fallback for null', () => {
      const out = renderKnetComponentsTable([
        {
          caseNumber: 'REF-KW-2026-000010',
          authCode: 'AUTH123',
          amount: 25,
          currency: 'KWD',
          customerName: 'Alice',
        },
        {
          caseNumber: 'REF-KW-2026-000011',
          authCode: null,
          amount: 25,
          currency: 'KWD',
          customerName: 'Bob',
        },
      ]);
      expect(out).toContain('Auth AUTH123');
      expect(out).toContain('Auth \u2014');
    });
  });

  describe('renderAuraOrdersTable', () => {
    it('returns "(none)" for empty rows', () => {
      expect(renderAuraOrdersTable([])).toBe('(none)');
    });

    it('formats email in angle brackets and points without currency', () => {
      const out = renderAuraOrdersTable([
        {
          caseNumber: 'REF-KW-2026-000020',
          orderNumber: 'O-9001',
          customerName: 'Alice',
          customerEmail: 'a@example.com',
          points: 500,
        },
      ]);
      expect(out).toContain('<a@example.com>');
      expect(out).toContain('500 points');
      expect(out).not.toContain('500 KWD');
    });
  });
});
