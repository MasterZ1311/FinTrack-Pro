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
});
