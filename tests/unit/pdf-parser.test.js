/**
 * FinTrack Pro — Unit Tests: PDF Statement Parser Engine
 * Tests coordinate-based row grouping, table header discovery, column classification,
 * and text-stream regex fallback.
 */

import { describe, it, expect } from 'vitest';
import {
  groupIntoRows,
  findTableHeader,
  classifyColumn,
  regexFallback,
} from '../../src/parsers/pdf-parser.js';

describe('PDF Statement Parser Engine (src/parsers/pdf-parser.js)', () => {
  describe('groupIntoRows()', () => {
    it('groups text items with similar Y coordinates into the same row', () => {
      const items = [
        { text: '15/08/2024', x: 50, y: 100 },
        { text: 'Grocery Store', x: 150, y: 102 }, // within 5px of 100
        { text: '500.00', x: 400, y: 99 },        // within 5px of 100
        { text: '16/08/2024', x: 50, y: 120 },     // new row
        { text: 'Salary Credit', x: 150, y: 121 },
      ];

      const rows = groupIntoRows(items, 5);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveLength(3);
      expect(rows[1]).toHaveLength(2);
    });

    it('sorts rows top-to-bottom by Y, and items within row left-to-right by X', () => {
      const items = [
        { text: 'Right', x: 300, y: 50 },
        { text: 'Left', x: 50, y: 50 },
        { text: 'Bottom', x: 50, y: 200 },
      ];

      const rows = groupIntoRows(items, 5);
      expect(rows).toHaveLength(2);
      expect(rows[0][0].text).toBe('Left');
      expect(rows[0][1].text).toBe('Right');
      expect(rows[1][0].text).toBe('Bottom');
    });

    it('returns empty array when given empty items', () => {
      expect(groupIntoRows([])).toEqual([]);
    });
  });

  describe('findTableHeader()', () => {
    it('locates header row and determines column X positions', () => {
      const rows = [
        [{ text: 'Statement of Account', x: 100, y: 20 }],
        [
          { text: 'Txn Date', x: 50, y: 50 },
          { text: 'Narration', x: 150, y: 50 },
          { text: 'Withdrawal Amt.', x: 350, y: 50 },
          { text: 'Deposit Amt.', x: 450, y: 50 },
          { text: 'Closing Balance', x: 550, y: 50 },
        ],
        [
          { text: '15/08/2024', x: 50, y: 70 },
          { text: 'Swiggy', x: 150, y: 70 },
        ],
      ];

      const header = findTableHeader(rows, 'Date');
      expect(header).not.toBeNull();
      expect(header.rowIndex).toBe(1);
      expect(header.columnPositions.date).toBe(50);
      expect(header.columnPositions.description).toBe(150);
      expect(header.columnPositions.debit).toBe(350);
      expect(header.columnPositions.credit).toBe(450);
      expect(header.columnPositions.balance).toBe(550);
    });

    it('returns null when no valid table header row exists', () => {
      const rows = [
        [{ text: 'Welcome to your bank statement', x: 10, y: 10 }],
        [{ text: 'Thank you for banking with us', x: 10, y: 30 }],
      ];

      expect(findTableHeader(rows, 'Date')).toBeNull();
    });
  });

  describe('classifyColumn()', () => {
    const columns = {
      date: 50,
      description: 180,
      debit: 350,
      credit: 450,
      balance: 550,
    };

    it('classifies item coordinate to nearest column within threshold', () => {
      expect(classifyColumn(52, columns)).toBe('date');
      expect(classifyColumn(178, columns)).toBe('description');
      expect(classifyColumn(348, columns)).toBe('debit');
      expect(classifyColumn(452, columns)).toBe('credit');
      expect(classifyColumn(551, columns)).toBe('balance');
    });

    it('returns null if item coordinate is outside threshold of all columns', () => {
      expect(classifyColumn(1000, columns)).toBeNull();
    });
  });

  describe('regexFallback()', () => {
    it('parses transaction lines with date, description, debit, and credit', async () => {
      const sampleText = `
        15/08/2024 UPI/SWIGGY/123 450.00 0.00 50000.00
        16/08/2024 SALARY CREDIT 0.00 150000.00 200000.00
      `;

      const txs = await regexFallback(sampleText);
      expect(txs.length).toBeGreaterThanOrEqual(1);
      expect(txs[0].date).toBe('2024-08-15');
      expect(txs[0].description).toContain('SWIGGY');
    });
  });
});
