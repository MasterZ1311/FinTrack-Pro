/**
 * FinTrack Pro — Unit Tests: Bank Statement Import Validation & Parsers
 */

import { describe, it, expect } from 'vitest';
import {
  parseDate,
  parseDateAuto,
  parseAmount,
  parseBankCSV,
} from '../../src/parsers/csv-parser.js';
import { parseOFX } from '../../src/parsers/ofx-parser.js';
import {
  HDFC_CSV_SAMPLE,
  SBI_CSV_SAMPLE,
  OFX_SAMPLE,
  MALFORMED_CSV_SAMPLE,
} from '../fixtures/statements.js';

describe('Statement Import & Parser Validation (src/parsers/)', () => {
  describe('parseDate() & parseDateAuto()', () => {
    it('parses DD/MM/YYYY into ISO YYYY-MM-DD', () => {
      expect(parseDate('15/08/2026', 'DD/MM/YYYY')).toBe('2026-08-15');
    });

    it('parses DD-MM-YYYY into ISO YYYY-MM-DD', () => {
      expect(parseDate('15-08-2026', 'DD-MM-YYYY')).toBe('2026-08-15');
    });

    it('parses MM/DD/YYYY (US standard) into ISO YYYY-MM-DD', () => {
      expect(parseDate('08/15/2026', 'MM/DD/YYYY')).toBe('2026-08-15');
    });

    it('parses 2-digit year format DD/MM/YY correctly', () => {
      expect(parseDate('15/08/26', 'DD/MM/YY')).toBe('2026-08-15');
    });

    it('returns null for unparseable or completely invalid dates', () => {
      expect(parseDate('not-a-date', 'DD/MM/YYYY')).toBeNull();
      expect(parseDate('', 'DD/MM/YYYY')).toBeNull();
      expect(parseDate(null, 'DD/MM/YYYY')).toBeNull();
    });

    it('auto-detects date formats in parseDateAuto', () => {
      expect(parseDateAuto('2026-08-15')).toBe('2026-08-15');
      expect(parseDateAuto('15/08/2026')).toBe('2026-08-15');
    });
  });

  describe('parseAmount()', () => {
    it('parses standard decimal amounts', () => {
      expect(parseAmount('1250.50')).toBe(1250.50);
      expect(parseAmount('1,250.50')).toBe(1250.50);
    });

    it('parses Indian number format with Lakhs separators', () => {
      expect(parseAmount('1,50,000.00', 'indian')).toBe(150000.00);
      expect(parseAmount('1,85,000.00')).toBe(185000.00);
    });

    it('parses negative amounts and amounts with currency symbols', () => {
      expect(parseAmount('-142.50')).toBe(-142.50);
      expect(parseAmount('₹ 489.00')).toBe(489.00);
      expect(parseAmount('$1,250.00')).toBe(1250.00);
    });

    it('handles parentheses for negative accounting values', () => {
      expect(parseAmount('(142.50)')).toBe(-142.50);
    });

    it('returns null for empty, whitespace, or invalid strings', () => {
      expect(parseAmount('')).toBeNull();
      expect(parseAmount('   ')).toBeNull();
      expect(parseAmount(null)).toBeNull();
      expect(parseAmount('-')).toBeNull();
    });
  });

  describe('parseBankCSV() — Indian & US Bank Statements', () => {
    it('parses HDFC Bank CSV statement sample accurately', async () => {
      const result = await parseBankCSV(HDFC_CSV_SAMPLE);
      expect(result.errors).toEqual([]);
      expect(result.transactions.length).toBeGreaterThanOrEqual(3);

      const firstTx = result.transactions[0];
      expect(firstTx).toHaveProperty('date');
      expect(firstTx).toHaveProperty('description');
      expect(firstTx.description).toContain('UPI-SWIGGY');
      expect(firstTx.debit).toBe(489.00);
      expect(firstTx.credit).toBeNull();
    });

    it('parses SBI Bank CSV statement sample accurately', async () => {
      const result = await parseBankCSV(SBI_CSV_SAMPLE);
      expect(result.errors).toEqual([]);
      expect(result.transactions.length).toBeGreaterThanOrEqual(3);

      const zomatoTx = result.transactions.find((t) => t.description.includes('ZOMATO'));
      expect(zomatoTx).toBeDefined();
      expect(zomatoTx.debit).toBe(320.00);
      expect(zomatoTx.credit).toBeNull();
    });

    it('parses Chase CSV statement when given Chase profile or standard Chase headers', async () => {
      const chaseContent = `Chase Bank Statement\nTransaction Date,Description,Amount,Type,Balance\n08/15/2024,WHOLEFDS MKT 1024,-142.50,DEBIT_CARD,2357.50\n08/18/2024,CONSULTING DIRECT DEP,5500.00,ACH,7857.50\n`;
      const result = await parseBankCSV(chaseContent);
      expect(result.transactions.length).toBe(2);

      const groceryTx = result.transactions.find((t) => t.description.includes('WHOLEFDS'));
      expect(groceryTx).toBeDefined();
      expect(groceryTx.debit).toBe(142.50);
    });

    it('handles malformed CSV gracefully with descriptive error message', async () => {
      const result = await parseBankCSV(MALFORMED_CSV_SAMPLE);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseOFX() — Open Financial Exchange Statements', () => {
    it('parses OFX statement SGML format and extracts transactions and bank info', async () => {
      const result = await parseOFX(OFX_SAMPLE);
      expect(result.errors).toEqual([]);
      expect(result.bankInfo).toBeDefined();
      expect(result.bankInfo.accountId).toBe('987654321');
      expect(result.bankInfo.currency).toBe('USD');

      expect(result.transactions).toHaveLength(2);

      const debitTx = result.transactions.find((t) => t.reference === 'FIT-2026-001');
      expect(debitTx).toBeDefined();
      expect(debitTx.date).toBe('2026-08-15');
      expect(debitTx.debit).toBe(142.50);
      expect(debitTx.credit).toBeNull();
      expect(debitTx.description).toContain('Whole Foods');

      const creditTx = result.transactions.find((t) => t.reference === 'FIT-2026-002');
      expect(creditTx).toBeDefined();
      expect(creditTx.date).toBe('2026-08-18');
      expect(creditTx.credit).toBe(5500.00);
      expect(creditTx.debit).toBeNull();
    });

    it('returns error when file does not contain valid OFX transactions', async () => {
      const result = await parseOFX('random non-ofx text content');
      expect(result.transactions).toEqual([]);
      expect(result.errors).toContain('No transactions found in OFX/QFX file.');
    });
  });
});
