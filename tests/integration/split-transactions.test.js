/**
 * FinTrack Pro — Integration Tests: Split Transactions Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { splitTransaction } from '../../src/modules/transactions/index.js';
import { add, getById } from '../../src/db.js';
import { store } from '../../src/store.js';
import { resetDatabase } from '../helpers/db-helper.js';

describe('Split Transactions Engine (src/modules/transactions/)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('splits a parent transaction into linked child transactions', async () => {
    const parentId = 'tx-parent-grocery-101';
    const parent = {
      id: parentId,
      date: '2026-09-01',
      description: 'Supermarket Big Store',
      amount: 250.00,
      currency: 'USD',
      type: 'expense',
      accountId: 'acc-1',
      category: 'Shopping',
      isSplit: false,
    };

    await add('transactions', parent);
    store.setState('transactions', [parent]);

    const splitParts = [
      { category: 'Groceries', amount: 150.00, notes: 'Food and produce' },
      { category: 'Electronics', amount: 100.00, notes: 'USB Cable' },
    ];

    const children = await splitTransaction(parentId, splitParts);

    expect(children).toHaveLength(2);
    expect(children[0].splitParentId).toBe(parentId);
    expect(children[0].amount).toBe(150.00);
    expect(children[0].category).toBe('Groceries');
    expect(children[1].splitParentId).toBe(parentId);
    expect(children[1].amount).toBe(100.00);
    expect(children[1].category).toBe('Electronics');

    // Verify parent in DB is marked isSplit
    const updatedParent = await getById('transactions', parentId);
    expect(updatedParent.isSplit).toBe(true);
    expect(updatedParent.splitParts).toEqual(splitParts);

    // Verify total children amount equals parent amount
    const totalChildren = children.reduce((sum, c) => sum + c.amount, 0);
    expect(totalChildren).toBe(parent.amount);
  });

  it('rejects split transaction when parts do not sum to parent amount', async () => {
    const parentId = 'tx-parent-bad-sum';
    const parent = {
      id: parentId,
      date: '2026-09-01',
      description: 'Dinner with friends',
      amount: 100.00,
      currency: 'INR',
      type: 'expense',
      accountId: 'acc-1',
      category: 'Food & Dining',
      isSplit: false,
    };

    await add('transactions', parent);
    store.setState('transactions', [parent]);

    const invalidParts = [
      { category: 'Food & Dining', amount: 40.00 },
      { category: 'Drinks', amount: 30.00 }, // Sum is 70, expected 100
    ];

    await expect(splitTransaction(parentId, invalidParts)).rejects.toThrow(
      /must equal original amount/
    );
  });

  it('throws when attempting to split a non-existent transaction', async () => {
    await expect(splitTransaction('non-existent-id', [{ category: 'Food', amount: 50 }])).rejects.toThrow(
      /not found/
    );
  });

  it('does not double count split parent in account balance and cascade deletes children', async () => {
    const { recalculateBalance } = await import('../../src/modules/accounts/index.js');
    const { deleteTransaction } = await import('../../src/modules/transactions/index.js');

    const accountId = 'acc-split-test-101';
    await add('accounts', {
      id: accountId,
      name: 'Checking Test',
      initialBalance: 1000,
      currentBalance: 1000,
      currency: 'USD',
    });

    const parentId = 'tx-split-parent-1';
    const parent = {
      id: parentId,
      date: '2026-09-10',
      description: 'Big Retail Store',
      amount: 100.00,
      currency: 'USD',
      type: 'expense',
      accountId,
      category: 'Shopping',
      isSplit: false,
    };

    await add('transactions', parent);
    store.setState('transactions', [parent]);
    await recalculateBalance(accountId);

    let acc = await getById('accounts', accountId);
    expect(acc.currentBalance).toBe(900); // 1000 - 100

    // Split into 60 + 40
    const children = await splitTransaction(parentId, [
      { category: 'Groceries', amount: 60, notes: 'Food' },
      { category: 'Electronics', amount: 40, notes: 'Gadget' },
    ]);
    expect(children).toHaveLength(2);

    // Verify account balance is 900, NOT 800 (which would be double counted!)
    await recalculateBalance(accountId);
    acc = await getById('accounts', accountId);
    expect(acc.currentBalance).toBe(900);

    // Delete parent transaction and verify children are cascade deleted
    await deleteTransaction(parentId);
    acc = await getById('accounts', accountId);
    expect(acc.currentBalance).toBe(1000); // restored

    const remainingParent = await getById('transactions', parentId);
    expect(remainingParent).toBeUndefined();

    for (const child of children) {
      const remainingChild = await getById('transactions', child.id);
      expect(remainingChild).toBeUndefined();
    }
  });
});
