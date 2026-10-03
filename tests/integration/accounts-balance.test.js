/**
 * FinTrack Pro — Integration Tests: Account Balance Calculations & Transfer Balancing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { recalculateBalance, createTransfer } from '../../src/modules/accounts/index.js';
import { add, getById, getAll } from '../../src/db.js';
import { resetDatabase } from '../helpers/db-helper.js';

describe('Account Balances & Transfer Balancing (src/modules/accounts/)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('recalculateBalance()', () => {
    it('calculates currentBalance from initialBalance plus income minus expenses', async () => {
      const accountId = 'acc-hdfc-test-01';
      await add('accounts', {
        id: accountId,
        name: 'HDFC Savings',
        type: 'savings',
        initialBalance: 50000,
        currency: 'INR',
      });

      // Add income
      await add('transactions', {
        id: 'tx-inc-1',
        accountId,
        type: 'income',
        amount: 25000,
        date: '2026-09-01',
        description: 'Salary Bonus',
      });

      // Add expense
      await add('transactions', {
        id: 'tx-exp-1',
        accountId,
        type: 'expense',
        amount: 8500,
        date: '2026-09-02',
        description: 'Electronics',
      });

      await recalculateBalance(accountId);

      const updated = await getById('accounts', accountId);
      // 50000 + 25000 - 8500 = 66500
      expect(updated.currentBalance).toBe(66500);
    });

    it('handles account with no transactions retaining initialBalance', async () => {
      const accountId = 'acc-empty-01';
      await add('accounts', {
        id: accountId,
        name: 'Empty Account',
        type: 'checking',
        initialBalance: 10000,
        currency: 'INR',
      });

      await recalculateBalance(accountId);

      const updated = await getById('accounts', accountId);
      expect(updated.currentBalance).toBe(10000);
    });
  });

  describe('createTransfer() — Double-Entry Transfer Balancing', () => {
    it('creates matching debit and credit transactions with identical transferId', async () => {
      const fromId = 'acc-from-checking';
      const toId = 'acc-to-savings';

      await add('accounts', {
        id: fromId,
        name: 'Checking',
        type: 'checking',
        initialBalance: 50000,
        currency: 'INR',
      });
      await add('accounts', {
        id: toId,
        name: 'Savings',
        type: 'savings',
        initialBalance: 20000,
        currency: 'INR',
      });

      await createTransfer(fromId, toId, 15000, '2026-09-01', 'Monthly Savings Transfer');

      // Verify transactions created in IndexedDB
      const allTransactions = await getAll('transactions');
      const transferTxs = allTransactions.filter((tx) => tx.category === 'Transfer');
      expect(transferTxs).toHaveLength(2);

      const fromTx = transferTxs.find((tx) => tx.accountId === fromId);
      const toTx = transferTxs.find((tx) => tx.accountId === toId);

      expect(fromTx).toBeDefined();
      expect(toTx).toBeDefined();

      // Verify double-entry types and amounts
      expect(fromTx.type).toBe('expense');
      expect(fromTx.amount).toBe(15000);
      expect(toTx.type).toBe('income');
      expect(toTx.amount).toBe(15000);

      // Verify transfer linkage
      expect(fromTx.transferId).toBeDefined();
      expect(fromTx.transferId).toBe(toTx.transferId);

      // Verify conservation of total funds
      const updatedFrom = await getById('accounts', fromId);
      const updatedTo = await getById('accounts', toId);

      expect(updatedFrom.currentBalance).toBe(35000); // 50000 - 15000
      expect(updatedTo.currentBalance).toBe(35000);   // 20000 + 15000

      const totalBefore = 50000 + 20000;
      const totalAfter = updatedFrom.currentBalance + updatedTo.currentBalance;
      expect(totalAfter).toBe(totalBefore);
    });

    it('symmetrically supports single-record type: transfer with native cross-currency balances', async () => {
      const fromAccId = 'acc-eur-wallet';
      const toAccId = 'acc-usd-checking';

      await add('accounts', {
        id: fromAccId,
        name: 'EUR Wallet',
        initialBalance: 1000,
        currency: 'EUR',
      });
      await add('accounts', {
        id: toAccId,
        name: 'USD Checking',
        initialBalance: 500,
        currency: 'USD',
      });

      // Transfer 100 EUR -> 108 USD
      await add('transactions', {
        id: 'tx-xfer-cross-1',
        type: 'transfer',
        accountId: fromAccId,
        toAccountId: toAccId,
        amount: 100, // EUR deducted
        targetAmount: 108, // USD credited
        currency: 'EUR',
        targetCurrency: 'USD',
        date: '2026-09-15',
      });

      await recalculateBalance(fromAccId);
      await recalculateBalance(toAccId);

      const eurAcc = await getById('accounts', fromAccId);
      const usdAcc = await getById('accounts', toAccId);

      // EUR wallet: 1000 - 100 = 900
      expect(eurAcc.currentBalance).toBe(900);
      expect(eurAcc.balance).toBe(900);

      // USD checking: 500 + 108 = 608
      expect(usdAcc.currentBalance).toBe(608);
      expect(usdAcc.balance).toBe(608);
    });

    it('gracefully handles legacy openingBalance and balance fields', async () => {
      const legacyAccId = 'acc-legacy-01';
      await add('accounts', {
        id: legacyAccId,
        name: 'Legacy Account',
        openingBalance: 2500,
        balance: 2500,
        currency: 'USD',
      });

      await add('transactions', {
        id: 'tx-leg-inc-1',
        type: 'income',
        accountId: legacyAccId,
        amount: 500,
        date: '2026-09-12',
      });

      await recalculateBalance(legacyAccId);

      const acc = await getById('accounts', legacyAccId);
      expect(acc.currentBalance).toBe(3000);
      expect(acc.balance).toBe(3000);
      expect(acc.initialBalance).toBe(2500);
    });
  });
});
