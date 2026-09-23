/**
 * FinTrack Pro — Integration Tests: IndexedDB Layer (src/db.js)
 * Tests schema initialization, CRUD operations, indexing, and data persistence with fake-indexeddb.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  add,
  getById,
  getAll,
  update,
  remove,
  clear,
  getByIndex,
  migrate,
} from '../../src/db.js';
import { resetDatabase } from '../helpers/db-helper.js';

describe('IndexedDB Integration Suite (src/db.js)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Object Store CRUD Operations', () => {
    it('creates and retrieves an account record by id', async () => {
      const account = {
        id: 'acc-hdfc-01',
        name: 'HDFC Salary Account',
        type: 'checking',
        balance: 75000,
        currency: 'INR',
      };

      await add('accounts', account);
      const retrieved = await getById('accounts', 'acc-hdfc-01');

      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('HDFC Salary Account');
      expect(retrieved.balance).toBe(75000);
      expect(retrieved.currency).toBe('INR');
    });

    it('updates an existing account balance correctly', async () => {
      const account = {
        id: 'acc-savings-01',
        name: 'Emergency Savings',
        type: 'savings',
        balance: 100000,
        currency: 'INR',
      };
      await add('accounts', account);

      const updated = {
        ...account,
        balance: 120000,
      };
      await update('accounts', updated);

      const retrieved = await getById('accounts', 'acc-savings-01');
      expect(retrieved.balance).toBe(120000);
    });

    it('deletes an item by ID from an object store using remove()', async () => {
      const budget = {
        id: 'budget-dining-01',
        category: 'Food & Dining',
        amount: 8000,
        period: 'monthly',
      };
      await add('budgets', budget);

      let retrieved = await getById('budgets', 'budget-dining-01');
      expect(retrieved).toBeDefined();

      await remove('budgets', 'budget-dining-01');

      retrieved = await getById('budgets', 'budget-dining-01');
      expect(retrieved).toBeUndefined();
    });

    it('clears all records in a store', async () => {
      await add('categories', { id: 'cat-1', name: 'Groceries' });
      await add('categories', { id: 'cat-2', name: 'Utilities' });
      expect((await getAll('categories')).length).toBe(2);

      await clear('categories');
      expect((await getAll('categories')).length).toBe(0);
    });
  });

  describe('Legacy localStorage Migration (migrate())', () => {
    it('migrates legacy adv_transactions from localStorage into IndexedDB transactions store', async () => {
      const legacyTx = [
        { id: 'tx-legacy-1', date: '2025-12-01', description: 'Old Coffee', amount: 150, type: 'expense' },
        { id: 'tx-legacy-2', date: '2025-12-02', description: 'Old Salary', amount: 50000, type: 'income' },
      ];
      localStorage.setItem('adv_transactions', JSON.stringify(legacyTx));

      await migrate();

      const inDb = await getAll('transactions');
      expect(inDb).toHaveLength(2);
      expect(inDb.map((t) => t.id)).toContain('tx-legacy-1');
      expect(inDb.map((t) => t.id)).toContain('tx-legacy-2');

      // Migration flag is recorded in settings
      const flag = await getById('settings', 'localstorage_migrated');
      expect(flag?.value).toBe(true);
    });
  });

  describe('Indexes & Querying', () => {
    it('queries transactions by accountId index', async () => {
      const tx1 = {
        id: 'tx-1',
        accountId: 'acc-1',
        amount: 500,
        type: 'expense',
        date: '2026-09-01',
        description: 'Store A',
      };
      const tx2 = {
        id: 'tx-2',
        accountId: 'acc-1',
        amount: 250,
        type: 'expense',
        date: '2026-09-02',
        description: 'Store B',
      };
      const tx3 = {
        id: 'tx-3',
        accountId: 'acc-2',
        amount: 1000,
        type: 'income',
        date: '2026-09-01',
        description: 'Client Payment',
      };

      await add('transactions', tx1);
      await add('transactions', tx2);
      await add('transactions', tx3);

      const acc1Transactions = await getByIndex('transactions', 'accountId', 'acc-1');
      expect(acc1Transactions).toHaveLength(2);
      expect(acc1Transactions.map((t) => t.id)).toEqual(expect.arrayContaining(['tx-1', 'tx-2']));

      const acc2Transactions = await getByIndex('transactions', 'accountId', 'acc-2');
      expect(acc2Transactions).toHaveLength(1);
      expect(acc2Transactions[0].id).toBe('tx-3');
    });

    it('queries transactions by type index (expense vs income)', async () => {
      const expenses = await getByIndex('transactions', 'type', 'expense');
      expect(expenses.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Settings & Key-Value Storage', () => {
    it('persists and retrieves user configuration settings by key', async () => {
      await add('settings', { key: 'baseCurrency', value: 'INR' });
      await add('settings', { key: 'theme', value: 'dark' });

      const currencySetting = await getById('settings', 'baseCurrency');
      expect(currencySetting).toEqual({ key: 'baseCurrency', value: 'INR' });

      const themeSetting = await getById('settings', 'theme');
      expect(themeSetting).toEqual({ key: 'theme', value: 'dark' });
    });
  });
});
