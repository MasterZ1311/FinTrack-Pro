/**
 * FinTrack Pro — Unit Tests: Transaction Validation & Schema Integrity
 */

import { describe, it, expect } from 'vitest';
import {
  validateTransaction,
  createTransactionDefaults,
  GST_RATES,
} from '../../src/modules/transactions/schema.js';
import { NORMAL_TRANSACTIONS } from '../fixtures/transactions.js';

describe('Transaction Schema & Validation Engine', () => {
  describe('Valid Transactions', () => {
    it('accepts a fully compliant normal expense transaction', () => {
      const validTx = { ...NORMAL_TRANSACTIONS[0] };
      const errors = validateTransaction(validTx);
      expect(errors).toEqual([]);
    });

    it('accepts a valid income transaction', () => {
      const validTx = { ...NORMAL_TRANSACTIONS[1] };
      const errors = validateTransaction(validTx);
      expect(errors).toEqual([]);
    });

    it('creates robust defaults with today date and valid UUID', () => {
      const tx = createTransactionDefaults({ description: 'Coffee', amount: 4.50, accountId: 'acc-1' });
      expect(tx.id).toBeDefined();
      expect(typeof tx.id).toBe('string');
      expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tx.description).toBe('Coffee');
      expect(tx.amount).toBe(4.50);
      expect(tx.type).toBe('expense');
      expect(tx.currency).toBe('INR');
    });
  });

  describe('Invalid / Malformed Transactions', () => {
    it('rejects empty or whitespace-only description', () => {
      const errors = validateTransaction({
        description: '   ',
        amount: 100,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
      });
      expect(errors).toContain('Description is required');
    });

    it('rejects negative amount', () => {
      const errors = validateTransaction({
        description: 'Groceries',
        amount: -150,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
      });
      expect(errors).toContain('Amount must be a positive number');
    });

    it('rejects zero amount', () => {
      const errors = validateTransaction({
        description: 'Zero item',
        amount: 0,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
      });
      expect(errors).toContain('Amount must be a positive number');
    });

    it('rejects non-numeric amount', () => {
      const errors = validateTransaction({
        description: 'NaN item',
        amount: 'one hundred',
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
      });
      expect(errors).toContain('Amount must be a positive number');
    });

    it('rejects non-ISO date formats', () => {
      const badDates = ['01/09/2026', '2026/09/01', '01-09-2026', '2026.09.01', 'not-a-date'];
      for (const badDate of badDates) {
        const errors = validateTransaction({
          description: 'Valid item',
          amount: 50,
          date: badDate,
          type: 'expense',
          accountId: 'acc-1',
        });
        expect(errors).toContain('Date must be in YYYY-MM-DD format');
      }
    });

    it('rejects unsupported transaction types', () => {
      const errors = validateTransaction({
        description: 'Bad type',
        amount: 50,
        date: '2026-09-01',
        type: 'credit_card',
        accountId: 'acc-1',
      });
      expect(errors.some((e) => e.includes('Type must be one of'))).toBe(true);
    });

    it('rejects missing accountId', () => {
      const errors = validateTransaction({
        description: 'No account',
        amount: 50,
        date: '2026-09-01',
        type: 'expense',
        accountId: '',
      });
      expect(errors).toContain('Account is required');
    });

    it('rejects transfers without destination account', () => {
      const errors = validateTransaction({
        description: 'Incomplete transfer',
        amount: 500,
        date: '2026-09-01',
        type: 'transfer',
        accountId: 'acc-checking',
        toAccountId: null,
      });
      expect(errors).toContain('Destination account is required for transfers');
    });

    it('rejects transfers where source and destination account are identical', () => {
      const errors = validateTransaction({
        description: 'Self transfer loop',
        amount: 500,
        date: '2026-09-01',
        type: 'transfer',
        accountId: 'acc-same',
        toAccountId: 'acc-same',
      });
      expect(errors).toContain('Source and destination accounts must differ for transfers');
    });

    it('rejects invalid payment methods', () => {
      const errors = validateTransaction({
        description: 'Item',
        amount: 50,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
        paymentMethod: 'crypto_token',
      });
      expect(errors.some((e) => e.includes('Payment method must be one of'))).toBe(true);
    });
  });

  describe('Split Transactions Validation', () => {
    it('rejects split transaction with fewer than 2 split parts', () => {
      const errors = validateTransaction({
        description: 'Single split',
        amount: 100,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
        isSplit: true,
        splitParts: [{ category: 'Food', amount: 100 }],
      });
      expect(errors).toContain('Split transactions require at least 2 parts');
    });

    it('rejects split parts whose sum does not equal total transaction amount', () => {
      const errors = validateTransaction({
        description: 'Unequal split',
        amount: 100,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
        isSplit: true,
        splitParts: [
          { category: 'Food', amount: 60 },
          { category: 'Transport', amount: 30 }, // Sum is 90, expected 100
        ],
      });
      expect(errors.some((e) => e.includes('Split parts total (90) must equal transaction amount (100)'))).toBe(true);
    });

    it('accepts split transaction where parts sum exactly to total amount', () => {
      const errors = validateTransaction({
        description: 'Equal split',
        amount: 100.50,
        date: '2026-09-01',
        type: 'expense',
        accountId: 'acc-1',
        isSplit: true,
        splitParts: [
          { category: 'Food', amount: 60.25 },
          { category: 'Transport', amount: 40.25 },
        ],
      });
      expect(errors).toEqual([]);
    });
  });

  describe('Corporate / GST Rate Validation', () => {
    it('accepts valid Indian GST tax rates', () => {
      for (const rate of GST_RATES) {
        const errors = validateTransaction({
          description: 'Consulting',
          amount: 1000,
          date: '2026-09-01',
          type: 'income',
          accountId: 'acc-1',
          gstRate: rate,
        });
        expect(errors).toEqual([]);
      }
    });

    it('rejects non-standard GST rate', () => {
      const errors = validateTransaction({
        description: 'Consulting',
        amount: 1000,
        date: '2026-09-01',
        type: 'income',
        accountId: 'acc-1',
        gstRate: 15, // Invalid in India
      });
      expect(errors.some((e) => e.includes('GST rate must be one of'))).toBe(true);
    });
  });
});
