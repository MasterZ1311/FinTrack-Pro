/**
 * FinTrack Pro — IndexedDB Wrapper
 * Full CRUD operations using the 'idb' library.
 * Handles schema creation, migration from localStorage, and data access.
 */

import { openDB } from 'idb';

const DB_NAME = 'fintrack-pro';
const DB_VERSION = 3;

/** @type {import('idb').IDBPDatabase | null} */
let dbInstance = null;

// ─── Database Initialization ──────────────────────────────────────────────────

const REQUIRED_STORES = [
  'profiles', 'transactions', 'accounts', 'investments',
  'budgets', 'categories', 'bankProfiles', 'aiCache',
  'exchangeRates', 'settings', 'credentials'
];

function upgradeSchema(db) {
  // profiles — Individual & Corporate Individual profiles
  if (!db.objectStoreNames.contains('profiles')) {
    db.createObjectStore('profiles', { keyPath: 'id' });
  }

  // transactions — with indexes for querying
  if (!db.objectStoreNames.contains('transactions')) {
    const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
    txStore.createIndex('date', 'date', { unique: false });
    txStore.createIndex('accountId', 'accountId', { unique: false });
    txStore.createIndex('category', 'category', { unique: false });
    txStore.createIndex('type', 'type', { unique: false });
  }

  // accounts
  if (!db.objectStoreNames.contains('accounts')) {
    db.createObjectStore('accounts', { keyPath: 'id' });
  }

  // investments
  if (!db.objectStoreNames.contains('investments')) {
    db.createObjectStore('investments', { keyPath: 'id' });
  }

  // budgets
  if (!db.objectStoreNames.contains('budgets')) {
    db.createObjectStore('budgets', { keyPath: 'id' });
  }

  // categories
  if (!db.objectStoreNames.contains('categories')) {
    db.createObjectStore('categories', { keyPath: 'id' });
  }

  // bankProfiles — saved import column mappings
  if (!db.objectStoreNames.contains('bankProfiles')) {
    db.createObjectStore('bankProfiles', { keyPath: 'id' });
  }

  // aiCache — categorization memory
  if (!db.objectStoreNames.contains('aiCache')) {
    db.createObjectStore('aiCache', { keyPath: 'id' });
  }

  // exchangeRates — keyed by currency code
  if (!db.objectStoreNames.contains('exchangeRates')) {
    db.createObjectStore('exchangeRates', { keyPath: 'currency' });
  }

  // settings — key-value store for app settings
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }

  // credentials — encrypted API keys and secrets at rest
  if (!db.objectStoreNames.contains('credentials')) {
    db.createObjectStore('credentials', { keyPath: 'id' });
  }
}

/**
 * Open (or create) the IndexedDB database with all required object stores.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade: upgradeSchema,
  });

  // Self-healing schema verification: if any required store is missing (due to schema drift without version bump),
  // dynamically re-open with an incremented database version to trigger upgradeSchema.
  const hasAllStores = REQUIRED_STORES.every(storeName => dbInstance.objectStoreNames.contains(storeName));
  if (!hasAllStores) {
    console.warn('[DB] Schema discrepancy detected (missing object store). Re-opening DB with incremented version...');
    const targetVersion = dbInstance.version + 1;
    dbInstance.close();
    dbInstance = await openDB(DB_NAME, targetVersion, {
      upgrade: upgradeSchema,
    });
  }

  return dbInstance;
}

// ─── Generic CRUD Operations ──────────────────────────────────────────────────

/**
 * Get all records from a store.
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export async function getAll(storeName) {
  const db = await getDB();
  return db.getAll(storeName);
}

/**
 * Get a single record by its key.
 * @param {string} storeName
 * @param {string|number} id
 * @returns {Promise<any|undefined>}
 */
export async function getById(storeName, id) {
  const db = await getDB();
  return db.get(storeName, id);
}

/**
 * Add a new record. Throws if key already exists.
 * @param {string} storeName
 * @param {object} record
 * @returns {Promise<IDBValidKey>}
 */
export async function add(storeName, record) {
  const db = await getDB();
  return db.add(storeName, record);
}

/**
 * Update (put) a record. Creates if doesn't exist.
 * @param {string} storeName
 * @param {object} record
 * @returns {Promise<IDBValidKey>}
 */
export async function update(storeName, record) {
  const db = await getDB();
  return db.put(storeName, record);
}

/**
 * Remove a record by its key.
 * @param {string} storeName
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export async function remove(storeName, id) {
  const db = await getDB();
  return db.delete(storeName, id);
}

/**
 * Clear all records in a store.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clear(storeName) {
  const db = await getDB();
  return db.clear(storeName);
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Get records from a store by index value.
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBValidKey} value
 * @returns {Promise<any[]>}
 */
export async function getByIndex(storeName, indexName, value) {
  const db = await getDB();
  return db.getAllFromIndex(storeName, indexName, value);
}

/**
 * Get records from a store by index range.
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBKeyRange} range
 * @returns {Promise<any[]>}
 */
export async function getByRange(storeName, indexName, range) {
  const db = await getDB();
  return db.getAllFromIndex(storeName, indexName, range);
}

// ─── Migration: localStorage → IndexedDB ──────────────────────────────────────

const MIGRATION_FLAG_KEY = 'localstorage_migrated';

/**
 * Migrate data from legacy localStorage keys into IndexedDB.
 * Runs once and sets a flag to prevent re-running.
 */
export async function migrate() {
  const db = await getDB();

  // Check if migration already happened
  const flag = await db.get('settings', MIGRATION_FLAG_KEY);
  if (flag?.value === true) {
    console.log('[DB] Migration already completed, skipping.');
    return;
  }

  console.log('[DB] Starting localStorage → IndexedDB migration...');
  let migrated = false;

  // Migrate transactions from 'adv_transactions'
  try {
    const rawTx = localStorage.getItem('adv_transactions');
    if (rawTx) {
      const transactions = JSON.parse(rawTx);
      if (Array.isArray(transactions) && transactions.length > 0) {
        const tx = db.transaction('transactions', 'readwrite');
        for (const record of transactions) {
          // Ensure each record has an id
          if (!record.id) {
            record.id = crypto.randomUUID();
          }
          await tx.store.put(record);
        }
        await tx.done;
        console.log(`[DB] Migrated ${transactions.length} transactions.`);
        migrated = true;
      }
    }
  } catch (err) {
    console.error('[DB] Failed to migrate transactions:', err);
  }

  // Migrate budgets from 'adv_budgets'
  try {
    const rawBudgets = localStorage.getItem('adv_budgets');
    if (rawBudgets) {
      const budgets = JSON.parse(rawBudgets);
      if (Array.isArray(budgets) && budgets.length > 0) {
        const tx = db.transaction('budgets', 'readwrite');
        for (const record of budgets) {
          if (!record.id) {
            record.id = crypto.randomUUID();
          }
          await tx.store.put(record);
        }
        await tx.done;
        console.log(`[DB] Migrated ${budgets.length} budgets.`);
        migrated = true;
      }
    }
  } catch (err) {
    console.error('[DB] Failed to migrate budgets:', err);
  }

  // Set the migration flag
  await db.put('settings', { key: MIGRATION_FLAG_KEY, value: true });

  if (migrated) {
    console.log('[DB] Migration complete. Legacy data preserved in localStorage.');
  } else {
    console.log('[DB] No legacy data found to migrate.');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export default {
  getAll,
  getById,
  add,
  update,
  remove,
  clear,
  getByIndex,
  getByRange,
  migrate,
};
