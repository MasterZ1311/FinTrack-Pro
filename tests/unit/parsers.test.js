/**
 * FinTrack Pro — Unit Tests: Bank Statement Parsers Regression Suite
 * Covers CSV, OFX, Indian Banking narrations, international formats, and date/amount utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  parseDate,
  parseDateAuto,
  parseAmount,
  detectBank,
  parseBankCSV,
} from '../../src/parsers/csv-parser.js';
import { parseOFX } from '../../src/parsers/ofx-parser.js';
import { generateHash } from '../../src/parsers/deduplication.js';
import {
  HDFC_CSV_SAMPLE,
  SBI_CSV_SAMPLE,
  OFX_SAMPLE,
} from '../fixtures/statements.js';

describe('Bank Statement Parsers Regression Suite', () => {
  // ─── Date Parsing ─────────────────────────────────────────────────────────
  describe('parseDate()', () => {
    it('parses DD/MM/YYYY format (Indian banks standard)', () => {
      expect(parseDate('15/08/2024', 'DD/MM/YYYY')).toBe('2024-08-15');
      expect(parseDate('01/01/2025', 'DD/MM/YYYY')).toBe('2025-01-01');
    });

    it('parses DD-MM-YYYY format (ICICI, Axis)', () => {
      expect(parseDate('25-12-2024', 'DD-MM-YYYY')).toBe('2024-12-25');
    });

    it('parses DD/MM/YY format with 2-digit year (HDFC)', () => {
      expect(parseDate('15/08/24', 'DD/MM/YY')).toBe('2024-08-15');
      expect(parseDate('10/05/98', 'DD/MM/YY')).toBe('1998-05-10');
    });

    it('parses MM/DD/YYYY format (US banks)', () => {
      expect(parseDate('08/15/2024', 'MM/DD/YYYY')).toBe('2024-08-15');
    });

    it('parses DD.MM.YYYY format (European/German)', () => {
      expect(parseDate('31.10.2024', 'DD.MM.YYYY')).toBe('2024-10-31');
    });

    it('parses YYYY-MM-DD format (ISO standard)', () => {
      expect(parseDate('2024-09-01', 'YYYY-MM-DD')).toBe('2024-09-01');
    });

    it('returns null for invalid dates or non-date strings', () => {
      expect(parseDate('32/13/2024', 'DD/MM/YYYY')).toBeNull();
      expect(parseDate('', 'DD/MM/YYYY')).toBeNull();
      expect(parseDate(null, 'DD/MM/YYYY')).toBeNull();
      expect(parseDate('not-a-date', 'DD/MM/YYYY')).toBeNull();
    });
  });

  describe('parseDateAuto()', () => {
    it('auto-detects DD/MM/YYYY when day > 12', () => {
      expect(parseDateAuto('15/08/2024')).toBe('2024-08-15');
    });

    it('auto-detects MM/DD/YYYY when month > 12 is impossible', () => {
      expect(parseDateAuto('08/25/2024')).toBe('2024-08-25');
    });

    it('returns null when string cannot be identified as date', () => {
      expect(parseDateAuto('invalid-date-string')).toBeNull();
      expect(parseDateAuto('')).toBeNull();
    });
  });

  // ─── Amount Parsing ───────────────────────────────────────────────────────
  describe('parseAmount()', () => {
    it('parses standard numbers: "1,500.00" -> 1500', () => {
      expect(parseAmount('1,500.00')).toBe(1500);
      expect(parseAmount('250.50')).toBe(250.5);
    });

    it('parses Indian lakh format: "1,50,000.00" -> 150000', () => {
      expect(parseAmount('1,50,000.00', 'lakh')).toBe(150000);
      expect(parseAmount('12,34,567.89', 'lakh')).toBe(1234567.89);
    });

    it('parses European format: "1.234,56" -> 1234.56', () => {
      expect(parseAmount('1.234,56', 'european')).toBe(1234.56);
      expect(parseAmount('12.345,00', 'european')).toBe(12345);
    });

    it('strips international currency symbols (€, ₹, $, £)', () => {
      expect(parseAmount('₹1,50,000.00', 'lakh')).toBe(150000);
      expect(parseAmount('$1,250.00')).toBe(1250);
      expect(parseAmount('€1.500,00', 'european')).toBe(1500);
      expect(parseAmount('£950.25')).toBe(950.25);
    });

    it('handles negative formats: leading minus, parentheses, DR/CR suffixes', () => {
      expect(parseAmount('-450.00')).toBe(-450);
      expect(parseAmount('(750.00)')).toBe(-750);
      expect(parseAmount('500.00DR')).toBe(-500);
      expect(parseAmount('500.00CR')).toBe(500);
    });

    it('returns null for empty strings or non-numeric tokens', () => {
      expect(parseAmount('')).toBeNull();
      expect(parseAmount('-')).toBeNull();
      expect(parseAmount('N/A')).toBeNull();
      expect(parseAmount(null)).toBeNull();
    });
  });

  // ─── Bank Detection ───────────────────────────────────────────────────────
  describe('detectBank()', () => {
    it('detects HDFC from standard statement headers', () => {
      const headers = ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'];
      const match = detectBank(headers, HDFC_CSV_SAMPLE);
      expect(match).not.toBeNull();
      expect(match.profile.id).toBe('hdfc');
    });

    it('detects SBI from transaction date and debit/credit headers', () => {
      const headers = ['Txn Date', 'Description', 'Ref No/Cheque No', 'Debit', 'Credit', 'Balance'];
      const match = detectBank(headers, SBI_CSV_SAMPLE);
      expect(match).not.toBeNull();
      expect(match.profile.id).toBe('sbi');
    });

    it('returns null for unrecognizable headers', () => {
      const headers = ['Foo', 'Bar', 'Baz'];
      expect(detectBank(headers, '')).toBeNull();
    });
  });

  // ─── CSV Statement Parsing ────────────────────────────────────────────────
  describe('parseBankCSV()', () => {
    it('parses HDFC CSV statement with UPI, NEFT, and POS transactions', async () => {
      const result = await parseBankCSV(HDFC_CSV_SAMPLE);
      expect(result.errors).toEqual([]);
      expect(result.transactions.length).toBeGreaterThanOrEqual(3);

      const upiTx = result.transactions.find((t) => t.description.includes('UPI-SWIGGY'));
      expect(upiTx).toBeDefined();
      expect(upiTx.debit).toBe(489.00);
      expect(upiTx.date).toBe('2024-08-15');

      const neftTx = result.transactions.find((t) => t.description.includes('NEFT-INFOSYS'));
      expect(neftTx).toBeDefined();
      expect(neftTx.credit).toBe(185000.00);
      expect(neftTx.date).toBe('2024-08-16');
    });

    it('parses SBI CSV statement', async () => {
      const result = await parseBankCSV(SBI_CSV_SAMPLE);
      expect(result.errors).toEqual([]);
      expect(result.transactions.length).toBe(3);

      const zomatoTx = result.transactions.find((t) => t.description.includes('ZOMATO'));
      expect(zomatoTx).toBeDefined();
      expect(zomatoTx.debit).toBe(320.00);
    });

    it('parses Chase CSV statement with single amount column', async () => {
      const chaseCSV = `Transaction Date,Description,Type,Amount\n08/15/2024,WHOLEFDS MKT 1024,DEBIT_CARD,-142.50\n08/18/2024,CONSULTING DIRECT DEP,ACH,5500.00\n08/20/2024,UBER TRIP,DEBIT_CARD,-24.80\n`;
      const result = await parseBankCSV(chaseCSV);
      expect(result.errors).toEqual([]);
      expect(result.transactions.length).toBe(3);

      const wholeFoods = result.transactions.find((t) => t.description.includes('WHOLEFDS'));
      expect(wholeFoods).toBeDefined();
      expect(wholeFoods.debit).toBe(142.50);

      const deposit = result.transactions.find((t) => t.description.includes('CONSULTING'));
      expect(deposit).toBeDefined();
      expect(deposit.credit).toBe(5500.00);
    });
  });

  // ─── OFX / QFX Parsing ────────────────────────────────────────────────────
  describe('parseOFX()', () => {
    it('parses OFX 1.x SGML statement format', async () => {
      const result = await parseOFX(OFX_SAMPLE);
      expect(result.errors).toEqual([]);
      expect(result.bankInfo.currency).toBe('USD');
      expect(result.bankInfo.accountId).toBe('987654321');
      expect(result.transactions).toHaveLength(2);

      const debit = result.transactions.find((t) => t.debit !== null);
      expect(debit).toBeDefined();
      expect(debit.debit).toBe(142.50);
      expect(debit.description).toContain('Whole Foods Market');
      expect(debit.reference).toBe('FIT-2026-001');

      const credit = result.transactions.find((t) => t.credit !== null);
      expect(credit).toBeDefined();
      expect(credit.credit).toBe(5500.00);
      expect(credit.reference).toBe('FIT-2026-002');
    });
  });

  // ─── Deduplication Hash Sign ──────────────────────────────────────────────
  describe('generateHash() with transaction type differentiation', () => {
    it('produces distinct hashes for debit vs credit with identical date, amount, and description', async () => {
      const date = '2026-09-01';
      const desc = 'Refund / Payment';
      const amount = 50.00;

      const expenseHash = await generateHash(date, desc, amount, 'expense');
      const incomeHash = await generateHash(date, desc, amount, 'income');

      expect(expenseHash).not.toBe(incomeHash);
      expect(expenseHash).toHaveLength(16);
      expect(incomeHash).toHaveLength(16);
    });
  });
});
