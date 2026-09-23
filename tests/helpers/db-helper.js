/**
 * FinTrack Pro — Database Test Helper
 * Provides database reset and seeding utilities using fake-indexeddb.
 */

import { clear, add, getAll } from '../../src/db.js';
import { store } from '../../src/store.js';

export async function resetDatabase() {
  const stores = [
    'profiles', 'transactions', 'accounts', 'investments',
    'budgets', 'categories', 'bankProfiles', 'aiCache',
    'exchangeRates', 'settings', 'credentials'
  ];

  for (const storeName of stores) {
    try {
      await clear(storeName);
    } catch {
      // Store might not exist yet before init
    }
  }

  // Reset in-memory store
  store.reset();
}

export async function seedAccounts(accounts) {
  for (const acc of accounts) {
    await add('accounts', { ...acc });
  }
  const all = await getAll('accounts');
  store.setState('accounts', all);
}

export async function seedTransactions(transactions) {
  for (const tx of transactions) {
    await add('transactions', { ...tx });
  }
  const all = await getAll('transactions');
  store.setState('transactions', all);
}
