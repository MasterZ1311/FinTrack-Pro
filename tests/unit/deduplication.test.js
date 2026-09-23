/**
 * FinTrack Pro — Unit Tests: Transaction Deduplication Engine
 */

import { describe, it, expect } from 'vitest';
import {
  generateHash,
  isDuplicate,
  deduplicateBatch,
} from '../../src/parsers/deduplication.js';


describe('Transaction Deduplication Engine (src/parsers/deduplication.js)', () => {
  describe('generateHash()', () => {
    it('generates a 16-character hexadecimal SHA-256 hash prefix', async () => {
      const hash = await generateHash('2026-09-01', 'Swiggy Food Delivery', 450);
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('produces identical hash regardless of case and surrounding whitespace in description', async () => {
      const hash1 = await generateHash('2026-09-01', 'SWIGGY FOOD DELIVERY', 450);
      const hash2 = await generateHash('2026-09-01', '   swiggy food delivery   ', 450);
      expect(hash1).toBe(hash2);
    });

    it('formats amount to 2 decimal places so 450 and 450.00 produce identical hashes', async () => {
      const hash1 = await generateHash('2026-09-01', 'Supermarket', 450);
      const hash2 = await generateHash('2026-09-01', 'Supermarket', 450.0);
      const hash3 = await generateHash('2026-09-01', 'Supermarket', 450.00);
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('produces different hashes for different dates', async () => {
      const hash1 = await generateHash('2026-09-01', 'Netflix', 649);
      const hash2 = await generateHash('2026-09-02', 'Netflix', 649);
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different amounts', async () => {
      const hash1 = await generateHash('2026-09-01', 'Netflix', 649);
      const hash2 = await generateHash('2026-09-01', 'Netflix', 799);
      expect(hash1).not.toBe(hash2);
    });

    /**
     * DOCUMENTED APPLICATION BEHAVIOR:
     * Due to Math.abs(amount) in src/parsers/deduplication.js line 17,
     * debit (-500) and credit (+500) on the same date with the same description
     * produce identical hashes. This test documents that behavior.
     */
    it('documents current behavior: Math.abs causes debit and credit to share identical hash', async () => {
      const debitHash = await generateHash('2026-09-01', 'Adjustment', -500);
      const creditHash = await generateHash('2026-09-01', 'Adjustment', 500);
      expect(debitHash).toBe(creditHash);
    });
  });

  describe('isDuplicate()', () => {
    it('returns true when hash exists in known hashes list', () => {
      const known = ['a1b2c3d4e5f60718', '9876543210abcdef'];
      expect(isDuplicate('a1b2c3d4e5f60718', known)).toBe(true);
    });

    it('returns false when hash is not in known hashes list', () => {
      const known = ['a1b2c3d4e5f60718'];
      expect(isDuplicate('deadbeef01234567', known)).toBe(false);
    });
  });

  describe('deduplicateBatch()', () => {
    it('splits a batch into unique and duplicates when checking against known existing hashes', async () => {
      const tx1 = {
        hash: await generateHash('2026-09-01', 'Swiggy', 450),
        description: 'Swiggy',
        amount: 450,
      };
      const tx2 = {
        hash: await generateHash('2026-09-02', 'Zomato', 320),
        description: 'Zomato',
        amount: 320,
      };

      const knownHashes = [tx1.hash];
      const result = await deduplicateBatch([tx1, tx2], knownHashes);

      expect(result.unique).toHaveLength(1);
      expect(result.unique[0].description).toBe('Zomato');
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].description).toBe('Swiggy');
    });

    it('detects and flags duplicate entries occurring within the same batch (second occurrence is duplicate)', async () => {
      const hash = await generateHash('2026-09-01', 'Uber Ride', 220);
      const txA = { id: 1, hash, description: 'Uber Ride', amount: 220 };
      const txB = { id: 2, hash, description: 'Uber Ride', amount: 220 };

      const result = await deduplicateBatch([txA, txB], []);
      expect(result.unique).toHaveLength(1);
      expect(result.unique[0].id).toBe(1);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].id).toBe(2);
    });

    it('accurately identifies duplicated transactions from real bank statement re-upload fixture', async () => {
      const existingDb = [
        { date: '2026-08-15', description: 'Swiggy Bangalore UPI/CR/1234', amount: 489.00 },
        { date: '2026-08-16', description: 'Starbucks Coffee Indiranagar', amount: 350.00 },
      ];

      const incomingBatch = [
        { date: '2026-08-15', description: 'Swiggy Bangalore UPI/CR/1234', amount: 489.00 },
        { date: '2026-08-16', description: 'Starbucks Coffee Indiranagar', amount: 350.00 },
        { date: '2026-08-17', description: 'Fresh Grocery Store', amount: 1200.00 },
      ];

      const knownHashes = [];
      for (const existing of existingDb) {
        knownHashes.push(await generateHash(existing.date, existing.description, existing.amount));
      }

      const parsedBatch = [];
      for (const raw of incomingBatch) {
        const hash = await generateHash(raw.date, raw.description, raw.amount);
        parsedBatch.push({ ...raw, hash });
      }

      const { unique, duplicates } = await deduplicateBatch(parsedBatch, knownHashes);

      expect(duplicates).toHaveLength(2);
      expect(unique).toHaveLength(1);
      expect(unique[0].description).toBe('Fresh Grocery Store');
    });
  });
});
