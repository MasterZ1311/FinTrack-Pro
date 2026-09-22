/**
 * FinTrack Pro — Unit Tests: Recurring Transactions Generation Engine
 */

import { describe, it, expect } from 'vitest';
import { generateRecurringInstances } from '../../src/modules/transactions/recurring.js';

describe('Recurring Transactions Engine (src/modules/transactions/recurring.js)', () => {
  describe('generateRecurringInstances()', () => {
    it('returns empty array when rule is missing or null', () => {
      expect(generateRecurringInstances(null, '2026-09-01')).toEqual([]);
      expect(generateRecurringInstances(undefined, '2026-09-01')).toEqual([]);
    });

    it('generates daily occurrences accurately', () => {
      const rule = { frequency: 'daily', interval: 1 };
      const instances = generateRecurringInstances(rule, '2026-09-01', 3);
      expect(instances).toEqual(['2026-09-02', '2026-09-03', '2026-09-04']);
    });

    it('generates weekly occurrences with 7-day intervals', () => {
      const rule = { frequency: 'weekly', interval: 1 };
      const instances = generateRecurringInstances(rule, '2026-09-01', 3);
      expect(instances).toEqual(['2026-09-08', '2026-09-15', '2026-09-22']);
    });

    it('generates bi-weekly occurrences with 14-day intervals', () => {
      const rule = { frequency: 'weekly', interval: 2 };
      const instances = generateRecurringInstances(rule, '2026-09-01', 2);
      expect(instances).toEqual(['2026-09-15', '2026-09-29']);
    });

    it('generates monthly occurrences snapping to specific dayOfMonth', () => {
      const rule = { frequency: 'monthly', interval: 1, dayOfMonth: 15 };
      const instances = generateRecurringInstances(rule, '2026-01-15', 3);
      expect(instances).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
    });

    it('generates quarterly occurrences with 3-month jumps', () => {
      const rule = { frequency: 'quarterly', interval: 1 };
      const instances = generateRecurringInstances(rule, '2026-01-01', 3);
      expect(instances).toEqual(['2026-04-01', '2026-07-01', '2026-10-01']);
    });

    it('generates yearly occurrences', () => {
      const rule = { frequency: 'yearly', interval: 1 };
      const instances = generateRecurringInstances(rule, '2026-01-01', 2);
      expect(instances).toEqual(['2027-01-01', '2028-01-01']);
    });

    it('respects maxOccurrences limit', () => {
      const rule = { frequency: 'monthly', interval: 1, maxOccurrences: 3 };
      const instances = generateRecurringInstances(rule, '2026-01-01', 12);
      expect(instances).toHaveLength(3);
    });

    it('stops generating occurrences once cutoff endDate is exceeded', () => {
      const rule = {
        frequency: 'monthly',
        interval: 1,
        endDate: '2026-03-20',
      };
      const instances = generateRecurringInstances(rule, '2026-01-01', 12);
      // Feb 1 and Mar 1 are <= Mar 20, Apr 1 exceeds cutoff
      expect(instances).toEqual(['2026-02-01', '2026-03-01']);
    });

    /**
     * DOCUMENTED BEHAVIOR / EDGE CASE:
     * When scheduling for day 31 of month, February has 28 days (non-leap year).
     * The engine snaps dayOfMonth to lastDay of February (2026-02-28).
     */
    it('clamps month-end dayOfMonth to the last day of shorter months like February', () => {
      const rule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
      const instances = generateRecurringInstances(rule, '2026-01-31', 3);
      // First occurrence is Feb 28 in 2026
      expect(instances[0]).toBe('2026-02-28');
    });
  });
});
