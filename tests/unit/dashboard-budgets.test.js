/**
 * FinTrack Pro — Unit Tests: Dashboard KPIs & Budget Calculation Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateKPIs,
  renderRecentTransactions,
} from '../../src/modules/dashboard/index.js';
import {
  getCurrentPeriod,
  getBudgetStatus,
} from '../../src/modules/budgets/index.js';
import { store } from '../../src/store.js';

describe('Dashboard KPIs & Budget Calculation Engine', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('calculateKPIs()', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    it('calculates total balance from all active accounts', () => {
      const accounts = [
        { id: 'a1', currentBalance: 5000 },
        { id: 'a2', balance: 2500 }, // legacy balance fallback
      ];

      const kpis = calculateKPIs([], accounts);
      expect(kpis.totalBalance).toBe(7500);
    });

    it('aggregates income and expenses for current month and calculates savings rate', () => {
      const accounts = [{ id: 'a1', currentBalance: 10000 }];
      const transactions = [
        { id: 't1', date: `${currentMonth}-05`, type: 'income', amount: 5000 },
        { id: 't2', date: `${currentMonth}-10`, type: 'expense', amount: 2000 },
        { id: 't3', date: '2020-01-01', type: 'expense', amount: 1000 }, // previous month/year
      ];

      const kpis = calculateKPIs(transactions, accounts);
      expect(kpis.incomeThisMonth).toBe(5000);
      expect(kpis.expensesThisMonth).toBe(2000);
      expect(kpis.savingsRate).toBe('60.0'); // (5000 - 2000) / 5000 = 60%
    });

    it('strictly excludes isSplit parent transactions from monthly totals', () => {
      const accounts = [{ id: 'a1', currentBalance: 10000 }];
      const transactions = [
        { id: 'parent-1', date: `${currentMonth}-05`, type: 'expense', amount: 100, isSplit: true },
        { id: 'child-1', date: `${currentMonth}-05`, type: 'expense', amount: 60, splitParentId: 'parent-1' },
        { id: 'child-2', date: `${currentMonth}-05`, type: 'expense', amount: 40, splitParentId: 'parent-1' },
      ];

      const kpis = calculateKPIs(transactions, accounts);
      // Expenses should be 100 (60 + 40), NOT 200 (100 parent + 100 children)
      expect(kpis.expensesThisMonth).toBe(100);
    });
  });

  describe('renderRecentTransactions()', () => {
    it('renders clean empty state when no transactions exist', () => {
      const html = renderRecentTransactions([]);
      expect(html).toContain('Your financial ledger is currently spotless');
    });

    it('filters out split parent transactions from recent list', () => {
      const transactions = [
        { id: 'parent', date: '2026-09-01', description: 'Split Parent', amount: 100, isSplit: true, type: 'expense' },
        { id: 'normal', date: '2026-09-02', description: 'Coffee Shop', amount: 5, isSplit: false, type: 'expense' },
      ];

      const html = renderRecentTransactions(transactions);
      expect(html).not.toContain('Split Parent');
      expect(html).toContain('Coffee Shop');
    });
  });

  describe('Budget Engine: getCurrentPeriod() & getBudgetStatus()', () => {
    it('determines monthly period start and end dates', () => {
      const budget = { period: 'monthly' };
      const period = getCurrentPeriod(budget);

      expect(period.start).toMatch(/^\d{4}-\d{2}-01$/);
      expect(period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('calculates spent amount, remaining budget, and percentage spent', () => {
      const budget = {
        id: 'b-groceries',
        category: 'Food & Dining',
        amount: 500,
        period: 'monthly',
      };

      store.setState('budgets', [budget]);
      store.setState('transactions', [
        { id: 't1', date: '2026-09-05', category: 'Food & Dining', type: 'expense', amount: 150 },
        { id: 't2', date: '2026-09-15', category: 'Food & Dining', type: 'expense', amount: 50 },
        { id: 't3', date: '2026-09-20', category: 'Shopping', type: 'expense', amount: 100 }, // different category
        { id: 't4', date: '2026-09-25', category: 'Food & Dining', type: 'income', amount: 50 }, // income ignored
      ]);

      const status = getBudgetStatus('b-groceries', '2026-09-01', '2026-09-30');
      expect(status.spent).toBe(200); // 150 + 50
      expect(status.remaining).toBe(300); // 500 - 200
      expect(status.percentage).toBe(40); // 200 / 500 = 40%
    });

    it('excludes isSplit parent transactions from budget spent calculations', () => {
      const budget = {
        id: 'b-food',
        category: 'Food & Dining',
        amount: 300,
        period: 'monthly',
      };

      store.setState('budgets', [budget]);
      store.setState('transactions', [
        { id: 'p-1', date: '2026-09-05', category: 'Food & Dining', type: 'expense', amount: 100, isSplit: true },
        { id: 'c-1', date: '2026-09-05', category: 'Food & Dining', type: 'expense', amount: 60, splitParentId: 'p-1' },
        { id: 'c-2', date: '2026-09-05', category: 'Food & Dining', type: 'expense', amount: 40, splitParentId: 'p-1' },
      ]);

      const status = getBudgetStatus('b-food', '2026-09-01', '2026-09-30');
      expect(status.spent).toBe(100); // only children counted
      expect(status.remaining).toBe(200);
    });
  });
});
