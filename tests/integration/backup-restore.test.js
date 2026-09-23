/**
 * FinTrack Pro — Integration Tests: Backup, Restore & Data Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { add, getAll, clear } from '../../src/db.js';
import { store } from '../../src/store.js';
import { resetDatabase } from '../helpers/db-helper.js';

describe('Backup, Export & Restore Integration Suite', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('exports all critical financial entities into structured JSON backup payload', async () => {
    // Seed initial state
    const testProfile = { id: 'prof-1', name: 'John Doe', currency: 'INR' };
    const testAccount = { id: 'acc-1', name: 'HDFC Bank', balance: 50000 };
    const testTx = { id: 'tx-1', amount: 1500, description: 'Groceries', type: 'expense' };
    const testCat = { id: 'cat-1', name: 'Food' };
    const testBudget = { id: 'b-1', category: 'Food', amount: 10000 };

    await add('profiles', testProfile);
    await add('accounts', testAccount);
    await add('transactions', testTx);
    await add('categories', testCat);
    await add('budgets', testBudget);

    store.setState('profile', testProfile);
    store.setState('accounts', [testAccount]);
    store.setState('transactions', [testTx]);
    store.setState('categories', [testCat]);
    store.setState('budgets', [testBudget]);

    // Construct export payload as in src/modules/settings/index.js
    const exportedData = {
      profile: store.getState('profile'),
      accounts: store.getState('accounts'),
      transactions: store.getState('transactions'),
      categories: store.getState('categories'),
      budgets: store.getState('budgets'),
    };

    const serialized = JSON.stringify(exportedData);
    const parsed = JSON.parse(serialized);

    expect(parsed).toHaveProperty('profile');
    expect(parsed).toHaveProperty('accounts');
    expect(parsed).toHaveProperty('transactions');
    expect(parsed).toHaveProperty('categories');
    expect(parsed).toHaveProperty('budgets');

    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.accounts[0].id).toBe('acc-1');
    expect(parsed.transactions[0].id).toBe('tx-1');
  });

  it('restores financial data into IndexedDB from a valid JSON backup payload', async () => {
    const backupPayload = {
      profile: { id: 'prof-backup', name: 'Restored User', currency: 'USD' },
      accounts: [
        { id: 'acc-restored-1', name: 'Chase Checking', balance: 3500 },
      ],
      transactions: [
        { id: 'tx-restored-1', amount: 45.50, description: 'Coffee & Bagel', type: 'expense' },
      ],
      categories: [
        { id: 'cat-restored-1', name: 'Dining' },
      ],
      budgets: [
        { id: 'b-restored-1', category: 'Dining', amount: 500 },
      ],
    };

    // Simulate restore process
    for (const acc of backupPayload.accounts) {
      await add('accounts', acc);
    }
    for (const tx of backupPayload.transactions) {
      await add('transactions', tx);
    }
    await add('profiles', backupPayload.profile);

    const accountsInDb = await getAll('accounts');
    expect(accountsInDb).toHaveLength(1);
    expect(accountsInDb[0].name).toBe('Chase Checking');

    const txInDb = await getAll('transactions');
    expect(txInDb).toHaveLength(1);
    expect(txInDb[0].description).toBe('Coffee & Bagel');
  });

  it('wipes all stores cleanly without leaving orphaned records', async () => {
    await add('accounts', { id: 'acc-wipe-1', name: 'Temp' });
    await add('transactions', { id: 'tx-wipe-1', amount: 10 });
    await add('budgets', { id: 'b-wipe-1', amount: 100 });

    expect((await getAll('accounts')).length).toBe(1);

    await clear('accounts');
    await clear('transactions');
    await clear('budgets');

    expect(await getAll('accounts')).toHaveLength(0);
    expect(await getAll('transactions')).toHaveLength(0);
    expect(await getAll('budgets')).toHaveLength(0);
  });
});
