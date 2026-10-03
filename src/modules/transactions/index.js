/**
 * FinTrack Pro — Transactions Module
 * Full-featured transaction list, add/edit modal, and CRUD engine.
 */

import { getAll, getById, getByIndex, add as dbAdd, update as dbUpdate, remove as dbRemove } from '../../db.js';
import { store } from '../../store.js';
import { validateTransaction, createTransactionDefaults } from './schema.js';
import {
  ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  getCategoryById, getCategoriesByType, CATEGORY_MAP,
} from './categories.js';
import { generateRecurringInstances } from './recurring.js';
import { convert } from '../../services/currency.js';
import { recalculateBalance } from '../accounts/index.js';
import { escapeHtml, safeAttr } from '../../utils/security.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_ICONS = {
  upi: '📱', neft: '🏦', imps: '⚡', cash: '💵',
  card: '💳', cheque: '📄', rtgs: '🏛️', other: '💰',
};

const PAYMENT_LABELS = {
  upi: 'UPI', neft: 'NEFT', imps: 'IMPS', cash: 'Cash',
  card: 'Card', cheque: 'Cheque', rtgs: 'RTGS', other: 'Other',
};

const VIRTUAL_ROW_HEIGHT = 64; // px, for virtual scroll estimation

// ─── CRUD Functions ───────────────────────────────────────────────────────────

/**
 * Add a new transaction.
 * Validates, assigns id/timestamps, saves to DB, updates store & account balance.
 * Triggers budget check after saving.
 *
 * @param {Partial<import('./schema.js').Transaction>} txData
 * @returns {Promise<import('./schema.js').Transaction>} The saved transaction
 * @throws {Error} If validation fails
 *
 * @example
 * await addTransaction({ description: 'Coffee', amount: 120, type: 'expense', ... });
 */
export async function addTransaction(txData) {
  const tx = createTransactionDefaults(txData);

  // Cross-currency transfer handling: determine source and target amounts in native currencies
  if (tx.type === 'transfer' && tx.toAccountId) {
    const fromAccount = await getById('accounts', tx.accountId);
    const toAccount = await getById('accounts', tx.toAccountId);
    const fromCurrency = tx.currency || fromAccount?.currency || tx.baseCurrency;
    const toCurrency = tx.targetCurrency || toAccount?.currency || fromCurrency;
    tx.currency = fromCurrency;
    tx.targetCurrency = toCurrency;
    if (tx.targetAmount === undefined || tx.targetAmount === null) {
      if (fromCurrency === toCurrency) {
        tx.targetAmount = tx.amount;
      } else {
        tx.targetAmount = await convertCurrency(tx.amount, fromCurrency, toCurrency);
      }
    }
  }

  // Convert currency if needed for base reporting
  if (tx.currency !== tx.baseCurrency) {
    tx.convertedAmount = await convertCurrency(tx.amount, tx.currency, tx.baseCurrency);
  } else {
    tx.convertedAmount = tx.amount;
  }

  const errors = validateTransaction(tx);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  await dbAdd('transactions', tx);
  await _updateAccountBalance(tx.accountId);
  if (tx.toAccountId) await _updateAccountBalance(tx.toAccountId);

  const all = await getAll('transactions');
  store.setState('transactions', all);

  // Async budget check — don't block the return
  import('../budgets/index.js').then((m) => m.checkAllBudgets?.()).catch(() => {});

  store.notify({ type: 'success', message: 'Transaction added successfully', duration: 3000 });
  return tx;
}

/**
 * Update an existing transaction.
 *
 * @param {string} id
 * @param {Partial<import('./schema.js').Transaction>} changes
 * @returns {Promise<import('./schema.js').Transaction>}
 * @throws {Error} If transaction not found or validation fails
 */
export async function updateTransaction(id, changes) {
  const existing = store.state.transactions.find((t) => t.id === id);
  if (!existing) throw new Error(`Transaction ${id} not found`);

  const updated = {
    ...existing,
    ...changes,
    id,
    updatedAt: new Date().toISOString(),
  };

  if (updated.type === 'transfer' && updated.toAccountId) {
    const fromAccount = await getById('accounts', updated.accountId);
    const toAccount = await getById('accounts', updated.toAccountId);
    const fromCurrency = updated.currency || fromAccount?.currency || updated.baseCurrency;
    const toCurrency = updated.targetCurrency || toAccount?.currency || fromCurrency;
    updated.currency = fromCurrency;
    updated.targetCurrency = toCurrency;
    if (updated.targetAmount === undefined || updated.targetAmount === null) {
      if (fromCurrency === toCurrency) {
        updated.targetAmount = updated.amount;
      } else {
        updated.targetAmount = await convertCurrency(updated.amount, fromCurrency, toCurrency);
      }
    }
  }

  if (updated.currency !== updated.baseCurrency) {
    updated.convertedAmount = await convertCurrency(
      updated.amount, updated.currency, updated.baseCurrency
    );
  } else {
    updated.convertedAmount = updated.amount;
  }

  const errors = validateTransaction(updated);
  if (errors.length > 0) throw new Error(`Validation failed: ${errors.join('; ')}`);

  await dbUpdate('transactions', updated);
  await _updateAccountBalance(updated.accountId);
  if (existing.accountId !== updated.accountId) await _updateAccountBalance(existing.accountId);
  if (updated.toAccountId) await _updateAccountBalance(updated.toAccountId);
  if (existing.toAccountId && existing.toAccountId !== updated.toAccountId) {
    await _updateAccountBalance(existing.toAccountId);
  }

  const all = await getAll('transactions');
  store.setState('transactions', all);

  import('../budgets/index.js').then((m) => m.checkAllBudgets?.()).catch(() => {});
  store.notify({ type: 'success', message: 'Transaction updated', duration: 3000 });
  return updated;
}

/**
 * Delete a transaction by id.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTransaction(id) {
  const existing = store.state.transactions.find((t) => t.id === id);
  if (!existing) return;

  // Cascade delete child sub-transactions linked via splitParentId
  let childTxs = [];
  try {
    childTxs = await getByIndex('transactions', 'splitParentId', id);
  } catch {
    const all = await getAll('transactions');
    childTxs = all.filter((t) => t.splitParentId === id);
  }

  const affectedAccountIds = new Set();
  if (existing.accountId) affectedAccountIds.add(existing.accountId);
  if (existing.toAccountId) affectedAccountIds.add(existing.toAccountId);

  for (const child of childTxs) {
    if (child.accountId) affectedAccountIds.add(child.accountId);
    if (child.toAccountId) affectedAccountIds.add(child.toAccountId);
    await dbRemove('transactions', child.id);
  }

  await dbRemove('transactions', id);

  for (const accId of affectedAccountIds) {
    await _updateAccountBalance(accId);
  }

  const all = await getAll('transactions');
  store.setState('transactions', all);
  store.notify({ type: 'success', message: 'Transaction deleted', duration: 3000 });
}

/**
 * Duplicate a transaction — creates a copy with a new id and today's date.
 *
 * @param {string} id
 * @returns {Promise<import('./schema.js').Transaction>}
 */
export async function duplicateTransaction(id) {
  const original = store.state.transactions.find((t) => t.id === id);
  if (!original) throw new Error(`Transaction ${id} not found`);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const copy = {
    ...original,
    id: crypto.randomUUID(),
    date: today,
    recurringId: null,
    isAutoGenerated: false,
    createdAt: now,
    updatedAt: now,
  };

  await dbAdd('transactions', copy);
  await _updateAccountBalance(copy.accountId);

  const all = await getAll('transactions');
  store.setState('transactions', all);
  store.notify({ type: 'success', message: 'Transaction duplicated', duration: 3000 });
  return copy;
}

/**
 * Split a transaction into multiple linked sub-transactions.
 * The original is marked isSplit=true and splitParts are stored.
 * Each part becomes an independent transaction linked via splitParentId.
 *
 * @param {string} id - Original transaction id
 * @param {Array<{category: string, amount: number, notes: string}>} splitParts
 * @returns {Promise<import('./schema.js').Transaction[]>} Created sub-transactions
 * @throws {Error} If split parts don't sum to original amount
 */
export async function splitTransaction(id, splitParts) {
  const original = store.state.transactions.find((t) => t.id === id);
  if (!original) throw new Error(`Transaction ${id} not found`);

  const total = splitParts.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(total - original.amount) > 0.01) {
    throw new Error(`Split parts (${total}) must equal original amount (${original.amount})`);
  }

  const now = new Date().toISOString();

  // Mark original as split parent
  await dbUpdate('transactions', {
    ...original,
    isSplit: true,
    splitParts,
    updatedAt: now,
  });

  const created = [];
  for (const part of splitParts) {
    const child = createTransactionDefaults({
      ...original,
      id: crypto.randomUUID(),
      amount: part.amount,
      convertedAmount: part.amount,
      category: part.category || original.category,
      notes: part.notes || '',
      isSplit: false,
      splitParts: null,
      splitParentId: id,
      createdAt: now,
      updatedAt: now,
    });
    await dbAdd('transactions', child);
    created.push(child);
  }

  // Update account balance immediately so that balance reflects split children and excludes parent
  await _updateAccountBalance(original.accountId);

  const all = await getAll('transactions');
  store.setState('transactions', all);
  store.notify({ type: 'success', message: `Transaction split into ${splitParts.length} parts`, duration: 3000 });
  return created;
}

// ─── Currency Conversion ──────────────────────────────────────────────────────

/**
 * Currency conversion helper.
 * Uses currency service or cached exchange rates from store, throws explicit error if unavailable.
 * @param {number} amount
 * @param {string} from
 * @param {string} to
 * @returns {Promise<number>}
 */
async function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  try {
    return convert(amount, from, to);
  } catch (_e) {
    const rates = store.state.settings?.exchangeRates;
    if (rates && rates[from] && rates[to]) {
      return (amount / rates[from]) * rates[to];
    }
    throw new Error(`Exchange rate unavailable from ${from} to ${to}`);
  }
}

// ─── Account Balance Update ───────────────────────────────────────────────────

/**
 * Recalculate and persist an account's balance from all its transactions.
 * @param {string} accountId
 * @returns {Promise<void>}
 */
async function _updateAccountBalance(accountId) {
  try {
    await recalculateBalance(accountId);
  } catch (err) {
    console.error('[Transactions] Balance update failed:', err);
  }
}

// ─── Filter & Sort Helpers ────────────────────────────────────────────────────

function applyFilters(transactions, filters) {
  let filtered = [...transactions];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (tx) =>
        tx.description?.toLowerCase().includes(q) ||
        tx.merchant?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        tx.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (filters.type) {
    filtered = filtered.filter((tx) => tx.type === filters.type);
  }
  if (filters.category) {
    filtered = filtered.filter((tx) => tx.category === filters.category);
  }
  if (filters.account) {
    filtered = filtered.filter(
      (tx) => tx.accountId === filters.account || tx.toAccountId === filters.account
    );
  }
  if (filters.dateRange?.start) {
    filtered = filtered.filter((tx) => tx.date >= filters.dateRange.start);
  }
  if (filters.dateRange?.end) {
    filtered = filtered.filter((tx) => tx.date <= filters.dateRange.end);
  }

  return filtered;
}

function sortTransactions(transactions, sortBy = 'date-desc') {
  const sorted = [...transactions];
  switch (sortBy) {
    case 'date-desc':
      return sorted.sort((a, b) => b.date.localeCompare(a.date));
    case 'date-asc':
      return sorted.sort((a, b) => a.date.localeCompare(b.date));
    case 'amount-desc':
      return sorted.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return sorted.sort((a, b) => a.amount - b.amount);
    case 'description':
      return sorted.sort((a, b) => a.description.localeCompare(b.description));
    default:
      return sorted;
  }
}

function groupByDate(transactions) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const groups = {};
  for (const tx of transactions) {
    let label;
    if (tx.date === today) label = 'Today';
    else if (tx.date === yesterday) label = 'Yesterday';
    else if (tx.date >= weekAgo) label = 'This Week';
    else {
      const d = new Date(tx.date);
      label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (!groups[label]) groups[label] = { label, date: tx.date, transactions: [] };
    groups[label].transactions.push(tx);
  }
  return Object.values(groups);
}

// ─── Module State ─────────────────────────────────────────────────────────────

let moduleState = {
  filters: {
    search: '',
    type: null,
    category: null,
    account: null,
    dateRange: null,
  },
  sortBy: 'date-desc',
  selectedIds: new Set(),
  bulkMode: false,
  editingId: null,
  unsubscribe: null,
  scrollTop: 0,
};

// ─── Render Helpers ───────────────────────────────────────────────────────────

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getCatIcon(categoryId) {
  return CATEGORY_MAP[categoryId]?.icon ?? '💰';
}

function getCatColor(categoryId) {
  return CATEGORY_MAP[categoryId]?.color ?? '#94a3b8';
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function renderTransactionRow(tx, bulkMode, isSelected, accounts) {
  const cat = CATEGORY_MAP[tx.category];
  const account = accounts.find((a) => a.id === tx.accountId);
  const isExpense = tx.type === 'expense';
  const isIncome = tx.type === 'income';
  const amountColor = isIncome
    ? 'var(--accent-success)'
    : isExpense
    ? 'var(--accent-danger)'
    : 'var(--accent-tertiary)';
  const amountPrefix = isIncome ? '+' : isExpense ? '−' : '⇄';

  return `
    <div class="tx-row ${isSelected ? 'selected' : ''}" data-id="${tx.id}" role="row">
      ${bulkMode ? `
        <label class="tx-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected ? 'checked' : ''} data-tx-select="${tx.id}">
          <span class="checkmark"></span>
        </label>
      ` : ''}
      <div class="tx-date-col">${formatDate(tx.date)}</div>
      <div class="tx-cat-icon" style="background:${cat?.colorHex ?? 'rgba(148,163,184,0.15)'}">
        <span>${cat?.icon ?? '💰'}</span>
      </div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.description || tx.merchant || '—')}</div>
        <div class="tx-meta">
          <span class="tx-cat-label">${escapeHtml(cat?.label ?? tx.category)}</span>
          ${tx.tags?.length > 0 ? tx.tags.slice(0, 2).map(tag => `<span class="tx-tag">${escapeHtml(tag)}</span>`).join('') : ''}
        </div>
      </div>
      <div class="tx-account">${escapeHtml(account?.name ?? '—')}</div>
      <div class="tx-amount" style="color:${amountColor}">
        ${amountPrefix}${formatCurrency(tx.amount, tx.currency)}
      </div>
      <div class="tx-actions" onclick="event.stopPropagation()">
        <button class="tx-action-btn" data-action="edit" data-id="${tx.id}" title="Edit">✏️</button>
        <button class="tx-action-btn" data-action="duplicate" data-id="${tx.id}" title="Duplicate">📋</button>
        <button class="tx-action-btn" data-action="delete" data-id="${tx.id}" title="Delete">🗑️</button>
        <button class="tx-action-btn" data-action="split" data-id="${tx.id}" title="Split">✂️</button>
      </div>
    </div>
  `;
}

// ─── Category Icon Grid ───────────────────────────────────────────────────────

function renderCategoryGrid(type, selectedId, onSelect) {
  const cats = getCategoriesByType(type === 'transfer' ? 'expense' : type);
  return `
    <div class="cat-grid" id="cat-grid">
      ${cats.map((c) => `
        <button type="button" class="cat-grid-item ${c.id === selectedId ? 'selected' : ''}"
          data-cat="${c.id}"
          style="--cat-color:${c.color};--cat-bg:${c.colorHex}"
          title="${c.label}">
          <span class="cat-grid-icon">${c.icon}</span>
          <span class="cat-grid-label">${c.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

function buildModal(tx = {}, accounts = [], isEdit = false) {
  const type = tx.type || 'expense';
  const selCat = tx.category || '';
  const selSubcat = tx.subcategory || '';
  const catObj = getCategoryById(selCat);
  const subcats = catObj?.subcategories ?? [];

  const accountOptions = accounts.map((a) =>
    `<option value="${a.id}" ${a.id === tx.accountId ? 'selected' : ''}>
      ${a.name} (${formatCurrency(a.balance ?? 0, a.currency)})
    </option>`
  ).join('');

  const toAccountOptions = accounts
    .filter((a) => a.id !== tx.accountId)
    .map((a) =>
      `<option value="${a.id}" ${a.id === tx.toAccountId ? 'selected' : ''}>${a.name}</option>`
    ).join('');

  const tags = Array.isArray(tx.tags) ? tx.tags : [];
  const today = new Date().toISOString().slice(0, 10);

  return `
    <div class="modal-overlay" id="tx-modal-overlay" role="dialog" aria-modal="true" aria-label="Add Transaction">
      <div class="modal-content tx-modal-content" id="tx-modal">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button class="btn btn-ghost modal-close" id="tx-modal-close" aria-label="Close">✕</button>
        </div>

        <form id="tx-form" novalidate>
          <!-- Type Toggle -->
          <div class="type-toggle-group" role="group" aria-label="Transaction type">
            ${['income', 'expense', 'transfer'].map((t) => `
              <button type="button" class="type-toggle-btn ${type === t ? 'active' : ''}"
                data-type="${t}" id="type-btn-${t}">
                ${t === 'income' ? '↑ Income' : t === 'expense' ? '↓ Expense' : '⇄ Transfer'}
              </button>
            `).join('')}
          </div>

          <!-- Amount -->
          <div class="form-group">
            <label class="form-label">Amount *</label>
            <div class="amount-input-wrapper">
              <span class="currency-prefix" id="currency-prefix">₹</span>
              <input type="number" class="input-field amount-input" id="tx-amount"
                placeholder="0.00" value="${tx.amount || ''}" min="0.01" step="0.01" required>
            </div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="form-label">Description *</label>
            <input type="text" class="input-field" id="tx-description"
              placeholder="What was this for?" value="${tx.description || ''}"
              autocomplete="off" list="merchant-suggestions">
            <datalist id="merchant-suggestions"></datalist>
          </div>

          <!-- Date -->
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="input-field" id="tx-date"
              value="${tx.date || today}" required>
          </div>

          <!-- Category -->
          <div class="form-group" id="cat-group">
            <label class="form-label">Category</label>
            <div id="cat-grid-wrapper">
              ${renderCategoryGrid(type, selCat)}
            </div>
          </div>

          <!-- Subcategory -->
          <div class="form-group" id="subcat-group" ${subcats.length === 0 ? 'style="display:none"' : ''}>
            <label class="form-label">Subcategory</label>
            <select class="select-field" id="tx-subcategory">
              <option value="">Select subcategory</option>
              ${subcats.map((s) => `<option value="${s}" ${s === selSubcat ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>

          <!-- Account -->
          <div class="form-group">
            <label class="form-label">Account *</label>
            <select class="select-field" id="tx-account" required>
              <option value="">Select account</option>
              ${accountOptions}
            </select>
          </div>

          <!-- To Account (Transfer only) -->
          <div class="form-group" id="to-account-group" ${type !== 'transfer' ? 'style="display:none"' : ''}>
            <label class="form-label">To Account *</label>
            <select class="select-field" id="tx-to-account">
              <option value="">Select destination</option>
              ${toAccountOptions}
            </select>
          </div>

          <!-- Payment Method -->
          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <div class="payment-method-grid" id="payment-grid" role="radiogroup">
              ${Object.entries(PAYMENT_ICONS).map(([m, icon]) => `
                <button type="button" class="payment-btn ${tx.paymentMethod === m ? 'active' : ''}"
                  data-method="${m}" title="${PAYMENT_LABELS[m]}">
                  <span>${icon}</span>
                  <span>${PAYMENT_LABELS[m]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- UTR / Ref Number (UPI/NEFT) -->
          <div class="form-group" id="utr-group" ${!['upi', 'neft', 'imps', 'rtgs'].includes(tx.paymentMethod) ? 'style="display:none"' : ''}>
            <label class="form-label">UTR / Reference Number</label>
            <input type="text" class="input-field" id="tx-utr"
              placeholder="e.g. 123456789012" value="${tx.utrNumber || ''}">
          </div>

          <!-- Tags -->
          <div class="form-group">
            <label class="form-label">Tags</label>
            <div class="tags-input-wrapper" id="tags-wrapper">
              ${tags.map((tag) => `
                <span class="chip tag-chip" data-tag="${safeAttr(tag)}">
                  ${escapeHtml(tag)} <button type="button" class="tag-remove" data-tag="${safeAttr(tag)}">✕</button>
                </span>
              `).join('')}
              <input type="text" class="tags-input" id="tags-input"
                placeholder="${tags.length === 0 ? 'Add tags…' : ''}" autocomplete="off">
            </div>
          </div>

          <!-- Notes -->
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="input-field" id="tx-notes" rows="2"
              placeholder="Optional notes…">${tx.notes || ''}</textarea>
          </div>

          <!-- Recurring Toggle -->
          <div class="form-group">
            <div class="toggle-row">
              <label class="form-label" for="tx-recurring-toggle">Recurring</label>
              <label class="toggle-switch">
                <input type="checkbox" id="tx-recurring-toggle" ${tx.isRecurring ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Recurring Settings -->
          <div id="recurring-settings" ${!tx.isRecurring ? 'style="display:none"' : ''}>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Frequency</label>
                <select class="select-field" id="tx-freq">
                  ${['daily','weekly','monthly','quarterly','yearly'].map((f) =>
                    `<option value="${f}" ${tx.recurringRule?.frequency === f ? 'selected' : ''}>${f.charAt(0).toUpperCase() + f.slice(1)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Every</label>
                <input type="number" class="input-field" id="tx-interval"
                  value="${tx.recurringRule?.interval || 1}" min="1" max="99">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">End Date (optional)</label>
                <input type="date" class="input-field" id="tx-recur-end"
                  value="${tx.recurringRule?.endDate || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Max Occurrences</label>
                <input type="number" class="input-field" id="tx-max-occ"
                  value="${tx.recurringRule?.maxOccurrences || ''}" min="1" placeholder="∞">
              </div>
            </div>
            <div class="recurring-preview" id="recurring-preview"></div>
          </div>

          <!-- Receipt Upload -->
          <div class="form-group">
            <label class="form-label">Receipt Photo</label>
            <div class="receipt-actions" style="display:flex;gap:10px;margin-bottom:10px;">
              <button type="button" class="btn btn-secondary" id="receipt-scan-btn" style="flex:1;">📷 Scan & Auto-fill</button>
            </div>
            <div class="receipt-upload" id="receipt-area">
              ${tx.receiptImage
                ? `<img src="${tx.receiptImage}" class="receipt-preview" id="receipt-img" alt="Receipt">`
                : `<div class="receipt-placeholder" id="receipt-placeholder">
                    <span>📁</span>
                    <span>Upload receipt</span>
                   </div>`
              }
              <input type="file" id="receipt-file" accept="image/*" style="display:none">
              <input type="file" id="receipt-scan-file" accept="image/*" capture="environment" style="display:none">
            </div>
          </div>

          <!-- Error Banner -->
          <div class="form-error" id="tx-form-error" style="display:none"></div>

          <!-- Actions -->
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="tx-modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="tx-form-submit">
              ${isEdit ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ─── Modal Controller ─────────────────────────────────────────────────────────

let currentTags = [];
let selectedCategory = '';
let selectedPaymentMethod = 'other';
let currentType = 'expense';
let receiptBase64 = null;

export function openModal(txData = {}, isEdit = false) {
  currentTags = Array.isArray(txData.tags) ? [...txData.tags] : [];
  selectedCategory = txData.category || '';
  selectedPaymentMethod = txData.paymentMethod || 'other';
  currentType = txData.type || 'expense';
  receiptBase64 = txData.receiptImage || null;

  const accounts = store.state.accounts;
  const html = buildModal(txData, accounts, isEdit);

  const overlay = document.createElement('div');
  overlay.innerHTML = html;
  const modalEl = overlay.firstElementChild;
  document.body.appendChild(modalEl);

  // ── Type toggle
  modalEl.querySelectorAll('.type-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      modalEl.querySelectorAll('.type-toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Show/hide transfer destination
      modalEl.querySelector('#to-account-group').style.display =
        currentType === 'transfer' ? '' : 'none';
      // Refresh category grid
      modalEl.querySelector('#cat-grid-wrapper').innerHTML = renderCategoryGrid(currentType, selectedCategory);
      attachCatGridListeners(modalEl);
    });
  });

  attachCatGridListeners(modalEl);

  // ── Payment method
  modalEl.querySelectorAll('.payment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPaymentMethod = btn.dataset.method;
      modalEl.querySelectorAll('.payment-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const utrGroup = modalEl.querySelector('#utr-group');
      utrGroup.style.display = ['upi', 'neft', 'imps', 'rtgs'].includes(selectedPaymentMethod) ? '' : 'none';
    });
  });

  // ── Tags
  const tagsInput = modalEl.querySelector('#tags-input');
  tagsInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagsInput.value.trim()) {
      e.preventDefault();
      const tag = tagsInput.value.trim().replace(/,/g, '');
      if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
        renderTags(modalEl);
      }
      tagsInput.value = '';
    }
    if (e.key === 'Backspace' && !tagsInput.value && currentTags.length > 0) {
      currentTags.pop();
      renderTags(modalEl);
    }
  });
  modalEl.querySelector('#tags-wrapper').addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-remove') || e.target.closest('.tag-remove')) {
      const tag = (e.target.closest('[data-tag]') || e.target).dataset.tag;
      currentTags = currentTags.filter((t) => t !== tag);
      renderTags(modalEl);
    }
  });

  // ── Recurring
  const recurringToggle = modalEl.querySelector('#tx-recurring-toggle');
  const recurringSettings = modalEl.querySelector('#recurring-settings');
  recurringToggle.addEventListener('change', () => {
    recurringSettings.style.display = recurringToggle.checked ? '' : 'none';
    if (recurringToggle.checked) updateRecurringPreview(modalEl);
  });
  ['#tx-freq', '#tx-interval', '#tx-recur-end', '#tx-max-occ', '#tx-date'].forEach((sel) => {
    modalEl.querySelector(sel)?.addEventListener('change', () => {
      if (recurringToggle.checked) updateRecurringPreview(modalEl);
    });
  });

  // ── Receipt upload
  const receiptArea = modalEl.querySelector('#receipt-area');
  const receiptFile = modalEl.querySelector('#receipt-file');
  const receiptScanBtn = modalEl.querySelector('#receipt-scan-btn');
  const receiptScanFile = modalEl.querySelector('#receipt-scan-file');

  receiptArea.addEventListener('click', () => receiptFile.click());
  if (receiptScanBtn) {
    receiptScanBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      receiptScanFile.click();
    });
  }

  const handleReceiptChange = async (e, doOcr = false) => {
    const file = e.target.files[0];
    if (!file) return;
    receiptBase64 = await _fileToBase64(file);
    const preview = modalEl.querySelector('#receipt-img');
    if (preview) {
      preview.src = receiptBase64;
    } else {
      modalEl.querySelector('#receipt-placeholder').outerHTML =
        `<img src="${receiptBase64}" class="receipt-preview" id="receipt-img" alt="Receipt">`;
    }

    if (doOcr) {
      try {
        const { extractTransactionFromImage } = await import('../../services/ocr.js');
        const { amount, date } = await extractTransactionFromImage(file);
        if (amount) modalEl.querySelector('#tx-amount').value = amount;
        if (date) modalEl.querySelector('#tx-date').value = date;
      } catch (err) {
        console.error('[Transactions] OCR Failed:', err);
      }
    }
  };

  receiptFile.addEventListener('change', (e) => handleReceiptChange(e, false));
  if (receiptScanFile) {
    receiptScanFile.addEventListener('change', (e) => handleReceiptChange(e, true));
  }

  // ── Merchant autocomplete
  const descriptions = [...new Set(
    store.state.transactions.map((t) => t.merchant || t.description).filter(Boolean)
  )];
  const datalist = modalEl.querySelector('#merchant-suggestions');
  descriptions.forEach((d) => {
    const option = document.createElement('option');
    option.value = d;
    datalist.appendChild(option);
  });

  // ── Close handlers
  const closeModal = () => {
    modalEl.remove();
    moduleState.editingId = null;
  };
  modalEl.querySelector('#tx-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('#tx-modal-cancel').addEventListener('click', closeModal);
  modalEl.querySelector('#tx-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'tx-modal-overlay') closeModal();
  });

  // ── Form submit
  modalEl.querySelector('#tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = modalEl.querySelector('#tx-form-error');
    errorEl.style.display = 'none';

    const txPayload = gatherFormData(modalEl, txData, isEdit);

    try {
      if (isEdit) {
        await updateTransaction(txData.id, txPayload);
      } else {
        await addTransaction(txPayload);
      }
      closeModal();
      renderList(document.getElementById('tx-list-container'));
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });
}

function attachCatGridListeners(modalEl) {
  modalEl.querySelectorAll('.cat-grid-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.cat;
      modalEl.querySelectorAll('.cat-grid-item').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Update subcategory dropdown
      const subcats = getCategoryById(selectedCategory)?.subcategories ?? [];
      const subcatGroup = modalEl.querySelector('#subcat-group');
      const subcatSel = modalEl.querySelector('#tx-subcategory');
      if (subcats.length > 0) {
        subcatSel.innerHTML = `<option value="">Select subcategory</option>` +
          subcats.map((s) => `<option value="${s}">${s}</option>`).join('');
        subcatGroup.style.display = '';
      } else {
        subcatGroup.style.display = 'none';
      }
    });
  });
}

function renderTags(modalEl) {
  const wrapper = modalEl.querySelector('#tags-wrapper');
  const input = wrapper.querySelector('#tags-input');
  // Remove all chip spans
  wrapper.querySelectorAll('.tag-chip').forEach((c) => c.remove());
  // Re-insert before input
  currentTags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'chip tag-chip';
    span.dataset.tag = tag;
    span.innerHTML = `${escapeHtml(tag)} <button type="button" class="tag-remove" data-tag="${safeAttr(tag)}">✕</button>`;
    wrapper.insertBefore(span, input);
  });
}

function updateRecurringPreview(modalEl) {
  const freq = modalEl.querySelector('#tx-freq')?.value || 'monthly';
  const interval = parseInt(modalEl.querySelector('#tx-interval')?.value || '1', 10);
  const endDate = modalEl.querySelector('#tx-recur-end')?.value || null;
  const maxOcc = parseInt(modalEl.querySelector('#tx-max-occ')?.value || '0', 10) || null;
  const startDate = modalEl.querySelector('#tx-date')?.value || new Date().toISOString().slice(0, 10);

  const rule = { frequency: freq, interval, endDate, maxOccurrences: maxOcc };
  const dates = generateRecurringInstances(rule, startDate, 5);

  const previewEl = modalEl.querySelector('#recurring-preview');
  previewEl.innerHTML = dates.length > 0
    ? `<p class="recur-preview-label">Next occurrences:</p>
       <div class="recur-preview-dates">${dates.map((d) =>
         `<span class="recur-date-chip">${new Date(d).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</span>`
       ).join('')}</div>`
    : '<p class="recur-preview-label">No upcoming occurrences</p>';
}

function gatherFormData(modalEl, existingTx, isEdit) {
  const recurring = modalEl.querySelector('#tx-recurring-toggle')?.checked;
  const recurringRule = recurring ? {
    frequency: modalEl.querySelector('#tx-freq')?.value || 'monthly',
    interval: parseInt(modalEl.querySelector('#tx-interval')?.value || '1', 10),
    dayOfMonth: null,
    endDate: modalEl.querySelector('#tx-recur-end')?.value || null,
    maxOccurrences: parseInt(modalEl.querySelector('#tx-max-occ')?.value || '0', 10) || null,
  } : null;

  return {
    ...(isEdit ? existingTx : {}),
    type: currentType,
    description: modalEl.querySelector('#tx-description')?.value.trim() || '',
    merchant: modalEl.querySelector('#tx-description')?.value.trim() || '',
    amount: parseFloat(modalEl.querySelector('#tx-amount')?.value || '0'),
    date: modalEl.querySelector('#tx-date')?.value || new Date().toISOString().slice(0, 10),
    category: selectedCategory,
    subcategory: modalEl.querySelector('#tx-subcategory')?.value || '',
    accountId: modalEl.querySelector('#tx-account')?.value || '',
    toAccountId: currentType === 'transfer' ? (modalEl.querySelector('#tx-to-account')?.value || null) : null,
    paymentMethod: selectedPaymentMethod,
    utrNumber: modalEl.querySelector('#tx-utr')?.value.trim() || '',
    tags: [...currentTags],
    notes: modalEl.querySelector('#tx-notes')?.value.trim() || '',
    isRecurring: recurring,
    recurringRule,
    receiptImage: receiptBase64,
    currency: store.state.settings?.currency || 'INR',
    baseCurrency: store.state.settings?.currency || 'INR',
    profileId: store.state.profile?.id || '',
  };
}

async function _fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function renderToolbar(container) {
  return `
    <div class="tx-toolbar" id="tx-toolbar">
      <div class="tx-toolbar-left">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" class="input-field search-input" id="tx-search"
            placeholder="Search transactions…" value="${moduleState.filters.search}" autocomplete="off">
        </div>
      </div>
      <div class="tx-toolbar-filters">
        <input type="date" class="input-field filter-date" id="filter-date-start"
          placeholder="From" value="${moduleState.filters.dateRange?.start || ''}"
          title="From date">
        <input type="date" class="input-field filter-date" id="filter-date-end"
          placeholder="To" value="${moduleState.filters.dateRange?.end || ''}"
          title="To date">
        <select class="select-field filter-select" id="filter-type">
          <option value="">All Types</option>
          ${['income','expense','transfer'].map((t) =>
            `<option value="${t}" ${moduleState.filters.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
          ).join('')}
        </select>
        <select class="select-field filter-select" id="filter-category">
          <option value="">All Categories</option>
          ${ALL_CATEGORIES.map((c) =>
            `<option value="${c.id}" ${moduleState.filters.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`
          ).join('')}
        </select>
        <select class="select-field filter-select" id="filter-account">
          <option value="">All Accounts</option>
          ${store.state.accounts.map((a) =>
            `<option value="${a.id}" ${moduleState.filters.account === a.id ? 'selected' : ''}>${a.name}</option>`
          ).join('')}
        </select>
        <select class="select-field filter-select" id="filter-sort">
          ${[
            ['date-desc','Date (Newest)'], ['date-asc','Date (Oldest)'],
            ['amount-desc','Amount (High)'], ['amount-asc','Amount (Low)'],
            ['description','Description A-Z'],
          ].map(([v, l]) =>
            `<option value="${v}" ${moduleState.sortBy === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
        <button class="btn btn-ghost bulk-toggle-btn" id="bulk-mode-btn" title="Bulk select">
          ☑️ Bulk
        </button>
      </div>
      <div class="tx-toolbar-right">
        <button class="btn btn-primary" id="add-tx-btn">
          <span>+</span> Add Transaction
        </button>
      </div>
    </div>
  `;
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

function renderBulkBar() {
  const count = moduleState.selectedIds.size;
  return `
    <div class="bulk-bar ${count > 0 ? 'visible' : ''}" id="bulk-bar">
      <span>${count} selected</span>
      <button class="btn btn-secondary" id="bulk-select-all">Select All</button>
      <button class="btn btn-secondary" id="bulk-recategorize">Re-categorize</button>
      <button class="btn btn-secondary" id="bulk-export">Export</button>
      <button class="btn btn-danger" id="bulk-delete">Delete</button>
      <button class="btn btn-ghost" id="bulk-cancel">Cancel</button>
    </div>
  `;
}

// ─── Virtual Scroll List ──────────────────────────────────────────────────────

function renderList(listContainer) {
  if (!listContainer) return;

  const transactions = store.state.transactions;
  const accounts = store.state.accounts;
  const filtered = applyFilters(transactions, moduleState.filters);
  const sorted = sortTransactions(filtered, moduleState.sortBy);
  const groups = groupByDate(sorted);

  if (sorted.length === 0) {
    listContainer.innerHTML = `
      <div class="tx-empty-state">
        <div class="empty-illustration">💸</div>
        <h3>No transactions yet</h3>
        <p>Add your first transaction to start tracking your finances</p>
        <button class="btn btn-primary" id="empty-add-btn">+ Add Transaction</button>
      </div>
    `;
    listContainer.querySelector('#empty-add-btn')?.addEventListener('click', () => openModal());
    return;
  }

  let html = '';
  for (const group of groups) {
    // Running balance for this day
    const dayTotal = group.transactions.reduce((sum, tx) => {
      if (tx.type === 'income') return sum + tx.amount;
      if (tx.type === 'expense') return sum - tx.amount;
      return sum;
    }, 0);
    const balanceColor = dayTotal >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';

    html += `
      <div class="tx-group-header" role="rowgroup">
        <span class="group-label">${group.label}</span>
        <span class="group-balance" style="color:${balanceColor}">
          ${dayTotal >= 0 ? '+' : ''}${formatCurrency(dayTotal)}
        </span>
      </div>
    `;

    for (const tx of group.transactions) {
      const isSelected = moduleState.selectedIds.has(tx.id);
      html += renderTransactionRow(tx, moduleState.bulkMode, isSelected, accounts);
    }
  }

  listContainer.innerHTML = html;

  // Row click → open edit modal
  listContainer.querySelectorAll('.tx-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (moduleState.bulkMode) {
        // Toggle selection
        const id = row.dataset.id;
        if (moduleState.selectedIds.has(id)) moduleState.selectedIds.delete(id);
        else moduleState.selectedIds.add(id);
        row.classList.toggle('selected');
        document.querySelector('#bulk-bar')?.classList.toggle('visible', moduleState.selectedIds.size > 0);
      } else {
        const id = row.dataset.id;
        const tx = store.state.transactions.find((t) => t.id === id);
        if (tx) openModal(tx, true);
      }
    });
  });

  // Checkbox selection
  listContainer.querySelectorAll('[data-tx-select]').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const id = checkbox.dataset.txSelect;
      if (e.target.checked) moduleState.selectedIds.add(id);
      else moduleState.selectedIds.delete(id);
    });
  });

  // Action buttons
  listContainer.querySelectorAll('.tx-action-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      const tx = store.state.transactions.find((t) => t.id === id);

      switch (action) {
        case 'edit':
          if (tx) openModal(tx, true);
          break;
        case 'duplicate':
          if (id) await duplicateTransaction(id);
          renderList(listContainer);
          break;
        case 'delete':
          if (id && confirm('Delete this transaction?')) {
            await deleteTransaction(id);
            renderList(listContainer);
          }
          break;
        case 'split':
          if (tx) openSplitModal(tx, listContainer);
          break;
      }
    });
  });
}

// ─── Simple Split Modal ───────────────────────────────────────────────────────

function openSplitModal(tx, listContainer) {
  const cats = getCategoriesByType(tx.type);
  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div class="modal-overlay" id="split-overlay">
      <div class="modal-content" style="max-width:420px">
        <div class="modal-header">
          <h2 class="modal-title">Split Transaction</h2>
          <button class="btn btn-ghost" id="split-close">✕</button>
        </div>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-4)">
          Total: ${formatCurrency(tx.amount, tx.currency)}
        </p>
        <div id="split-parts">
          ${[0,1].map((i) => splitPartRow(i, cats, tx.amount / 2)).join('')}
        </div>
        <button class="btn btn-secondary" id="split-add-part" style="margin:8px 0;width:100%">+ Add Part</button>
        <div class="form-error" id="split-error" style="display:none"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="split-cancel">Cancel</button>
          <button class="btn btn-primary" id="split-submit">Split</button>
        </div>
      </div>
    </div>
  `;
  const el = overlay.firstElementChild;
  document.body.appendChild(el);

  let partCount = 2;

  el.querySelector('#split-close').onclick = () => el.remove();
  el.querySelector('#split-cancel').onclick = () => el.remove();
  el.querySelector('#split-add-part').onclick = () => {
    const partsEl = el.querySelector('#split-parts');
    partsEl.insertAdjacentHTML('beforeend', splitPartRow(partCount++, cats, 0));
  };
  el.querySelector('#split-submit').onclick = async () => {
    const rows = el.querySelectorAll('.split-part-row');
    const parts = [];
    rows.forEach((row) => {
      parts.push({
        category: row.querySelector('.split-cat').value,
        amount: parseFloat(row.querySelector('.split-amount').value || '0'),
        notes: row.querySelector('.split-notes').value,
      });
    });
    try {
      await splitTransaction(tx.id, parts);
      el.remove();
      renderList(listContainer);
    } catch (err) {
      el.querySelector('#split-error').textContent = err.message;
      el.querySelector('#split-error').style.display = 'block';
    }
  };
}

function splitPartRow(i, cats, defaultAmount) {
  return `
    <div class="split-part-row" style="display:grid;grid-template-columns:1fr 100px 1fr;gap:8px;margin-bottom:8px">
      <select class="select-field split-cat">
        ${cats.map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
      </select>
      <input type="number" class="input-field split-amount" placeholder="Amount" value="${defaultAmount.toFixed(2)}" min="0" step="0.01">
      <input type="text" class="input-field split-notes" placeholder="Notes">
    </div>
  `;
}

// ─── Main Render ──────────────────────────────────────────────────────────────

function attachToolbarListeners(container) {
  const listContainer = container.querySelector('#tx-list-container');

  // Search (debounced)
  let searchTimer;
  container.querySelector('#tx-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      moduleState.filters.search = e.target.value;
      renderList(listContainer);
    }, 250);
  });

  // Filters
  ['filter-type', 'filter-category', 'filter-account', 'filter-sort'].forEach((id) => {
    container.querySelector(`#${id}`)?.addEventListener('change', (e) => {
      if (id === 'filter-type') moduleState.filters.type = e.target.value || null;
      if (id === 'filter-category') moduleState.filters.category = e.target.value || null;
      if (id === 'filter-account') moduleState.filters.account = e.target.value || null;
      if (id === 'filter-sort') moduleState.sortBy = e.target.value;
      renderList(listContainer);
    });
  });

  ['filter-date-start', 'filter-date-end'].forEach((id) => {
    container.querySelector(`#${id}`)?.addEventListener('change', (e) => {
      if (!moduleState.filters.dateRange) moduleState.filters.dateRange = {};
      if (id === 'filter-date-start') moduleState.filters.dateRange.start = e.target.value || null;
      if (id === 'filter-date-end') moduleState.filters.dateRange.end = e.target.value || null;
      renderList(listContainer);
    });
  });

  // Add transaction
  container.querySelector('#add-tx-btn')?.addEventListener('click', () => {
    openModal();
  });

  // Bulk mode
  container.querySelector('#bulk-mode-btn')?.addEventListener('click', () => {
    moduleState.bulkMode = !moduleState.bulkMode;
    moduleState.selectedIds.clear();
    renderList(listContainer);
  });

  // Bulk actions
  container.querySelector('#bulk-cancel')?.addEventListener('click', () => {
    moduleState.bulkMode = false;
    moduleState.selectedIds.clear();
    renderList(listContainer);
  });
  container.querySelector('#bulk-select-all')?.addEventListener('click', () => {
    const all = store.state.transactions;
    applyFilters(all, moduleState.filters).forEach((tx) => moduleState.selectedIds.add(tx.id));
    renderList(listContainer);
  });
  container.querySelector('#bulk-delete')?.addEventListener('click', async () => {
    const ids = [...moduleState.selectedIds];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} transaction(s)?`)) return;
    for (const id of ids) await deleteTransaction(id);
    moduleState.selectedIds.clear();
    moduleState.bulkMode = false;
    renderList(listContainer);
  });
}

// ─── Module Export ────────────────────────────────────────────────────────────

export default {
  /**
   * Render the full transactions page into the given container.
   * @param {HTMLElement} container
   */
  async render(container) {
    // Inject page styles
    injectStyles();

    container.innerHTML = `
      <div class="tx-page" id="tx-page">
        <div class="page-header">
          <div>
            <h1 class="page-title">Transactions</h1>
            <p class="page-subtitle">Track every rupee in and out</p>
          </div>
        </div>
        ${renderToolbar(container)}
        ${renderBulkBar()}
        <div class="tx-list-container" id="tx-list-container">
          <div class="tx-loading">
            <div class="skeleton" style="height:64px;margin-bottom:8px;border-radius:12px"></div>
            <div class="skeleton" style="height:64px;margin-bottom:8px;border-radius:12px"></div>
            <div class="skeleton" style="height:64px;border-radius:12px"></div>
          </div>
        </div>
      </div>
    `;

    attachToolbarListeners(container);

    const listContainer = container.querySelector('#tx-list-container');
    renderList(listContainer);

    // Subscribe to store changes
    moduleState.unsubscribe = store.subscribe('transactions', () => {
      renderList(listContainer);
    });
  },

  destroy() {
    moduleState.unsubscribe?.();
    moduleState.selectedIds.clear();
    moduleState.bulkMode = false;
  },
};

// CRUD functions are already exported via `export async function` declarations above.

// ─── CSS Injection ─────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('tx-module-styles')) return;
  const style = document.createElement('style');
  style.id = 'tx-module-styles';
  style.textContent = `
    /* ── Transactions Page ─────────────────────────────── */
    .tx-page { padding: var(--space-6); max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: var(--space-6); }
    .page-title { font-size: 1.875rem; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-secondary); font-size: 0.9rem; margin: 0; }

    /* Toolbar */
    .tx-toolbar { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
      background: var(--bg-surface); border: var(--glass-border); border-radius: var(--radius-lg);
      padding: var(--space-4); margin-bottom: var(--space-4); }
    .tx-toolbar-left { flex: 0 0 auto; min-width: 200px; }
    .tx-toolbar-filters { display: flex; gap: var(--space-2); flex-wrap: wrap; flex: 1; }
    .tx-toolbar-right { flex: 0 0 auto; margin-left: auto; }
    .search-wrapper { position: relative; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.85rem; }
    .search-input { padding-left: 36px !important; min-width: 200px; }
    .filter-select, .filter-date { font-size: 0.8rem; padding: var(--space-2) var(--space-3); }
    .filter-date { width: 130px; }

    /* Bulk bar */
    .bulk-bar { display: none; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4);
      background: rgba(99,102,241,0.1); border: 1px solid var(--border-accent);
      border-radius: var(--radius-md); margin-bottom: var(--space-3); }
    .bulk-bar.visible { display: flex; }

    /* Group header */
    .tx-group-header { display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-3) var(--space-4); color: var(--text-secondary); font-size: 0.8rem;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-top: var(--space-4); }
    .group-balance { font-weight: 700; font-size: 0.85rem; }

    /* Transaction Row */
    .tx-row { display: grid; grid-template-columns: 52px 40px 1fr auto auto auto;
      align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4);
      background: var(--bg-surface); border: var(--glass-border); border-radius: var(--radius-md);
      margin-bottom: var(--space-2); cursor: pointer; transition: all 0.2s ease;
      animation: fadeIn 0.2s ease; }
    .tx-row:hover { background: var(--bg-surface-hover); transform: translateX(2px); }
    .tx-row.selected { border-color: var(--accent-primary); background: rgba(99,102,241,0.08); }
    .tx-row.bulk-mode { grid-template-columns: 24px 52px 40px 1fr auto auto auto; }
    .tx-date-col { font-size: 0.75rem; color: var(--text-secondary); text-align: center; white-space: nowrap; }
    .tx-cat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex;
      align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
    .tx-info { min-width: 0; }
    .tx-desc { font-weight: 500; color: var(--text-primary); font-size: 0.9rem;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tx-meta { display: flex; gap: var(--space-2); align-items: center; margin-top: 2px; }
    .tx-cat-label { font-size: 0.75rem; color: var(--text-secondary); }
    .tx-tag { font-size: 0.7rem; background: rgba(99,102,241,0.15);
      color: var(--accent-primary); padding: 1px 8px; border-radius: 999px; }
    .tx-account { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
    .tx-amount { font-weight: 700; font-size: 0.95rem; white-space: nowrap; text-align: right; }
    .tx-actions { display: flex; gap: var(--space-1); opacity: 0; transition: opacity 0.2s; }
    .tx-row:hover .tx-actions { opacity: 1; }
    .tx-action-btn { background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 6px; font-size: 0.85rem; transition: background 0.2s; }
    .tx-action-btn:hover { background: var(--bg-surface-hover); }

    /* Checkbox */
    .tx-checkbox { cursor: pointer; }
    .tx-checkbox input { width: 16px; height: 16px; }

    /* Empty state */
    .tx-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px var(--space-6); text-align: center; gap: var(--space-4); }
    .empty-illustration { font-size: 4rem; line-height: 1; }
    .tx-empty-state h3 { font-size: 1.25rem; color: var(--text-primary); margin: 0; }
    .tx-empty-state p { color: var(--text-secondary); margin: 0; }

    /* Loading */
    .tx-loading { padding: var(--space-4); }

    /* ── Modal ─────────────────────────────────────── */
    .tx-modal-content { max-width: 640px; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); }
    .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0; }
    .modal-close { font-size: 1.2rem; line-height: 1; }
    .modal-actions { display: flex; gap: var(--space-3); justify-content: flex-end;
      margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border-subtle); }

    /* Form */
    .form-group { margin-bottom: var(--space-4); }
    .form-label { display: block; font-size: 0.8rem; font-weight: 600;
      color: var(--text-secondary); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.05em; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .form-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      color: var(--accent-danger); padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md); font-size: 0.875rem; margin-top: var(--space-3); }

    /* Type Toggle */
    .type-toggle-group { display: flex; gap: 0; background: var(--bg-surface);
      border: var(--glass-border); border-radius: var(--radius-md); padding: 4px;
      margin-bottom: var(--space-5); }
    .type-toggle-btn { flex: 1; padding: var(--space-2); background: none; border: none;
      color: var(--text-secondary); font-family: var(--font-sans); font-size: 0.875rem;
      font-weight: 500; cursor: pointer; border-radius: var(--radius-sm); transition: all 0.2s; }
    .type-toggle-btn.active { background: var(--accent-primary); color: #fff;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4); }

    /* Amount Input */
    .amount-input-wrapper { position: relative; }
    .currency-prefix { position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
      color: var(--text-secondary); font-weight: 600; font-size: 1rem; }
    .amount-input { padding-left: 36px !important; font-size: 1.5rem !important; font-weight: 700; }

    /* Category Grid */
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: var(--space-2); }
    .cat-grid-item { display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: var(--space-2); background: var(--bg-surface); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md); cursor: pointer; font-family: var(--font-sans);
      transition: all 0.2s; color: var(--text-secondary); font-size: 0.75rem; }
    .cat-grid-item:hover { background: var(--bg-surface-hover); border-color: var(--cat-color, var(--accent-primary)); }
    .cat-grid-item.selected { background: var(--cat-bg, rgba(99,102,241,0.15));
      border-color: var(--cat-color, var(--accent-primary)); color: var(--cat-color, var(--accent-primary)); }
    .cat-grid-icon { font-size: 1.4rem; line-height: 1; }
    .cat-grid-label { text-align: center; line-height: 1.2; }

    /* Payment Methods */
    .payment-method-grid { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .payment-btn { display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: var(--space-2) var(--space-3); background: var(--bg-surface);
      border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
      cursor: pointer; font-family: var(--font-sans); font-size: 0.75rem;
      color: var(--text-secondary); transition: all 0.2s; }
    .payment-btn:hover { background: var(--bg-surface-hover); }
    .payment-btn.active { background: rgba(99,102,241,0.15);
      border-color: var(--accent-primary); color: var(--accent-primary); }

    /* Tags Input */
    .tags-input-wrapper { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center;
      background: var(--bg-surface); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md); padding: var(--space-2) var(--space-3);
      cursor: text; min-height: 44px; transition: border-color 0.2s; }
    .tags-input-wrapper:focus-within { border-color: var(--accent-primary); box-shadow: 0 0 0 3px var(--border-accent); }
    .tags-input { flex: 1; background: none; border: none; outline: none;
      color: var(--text-primary); font-family: var(--font-sans); min-width: 80px; }
    .tag-chip { cursor: default; }
    .tag-remove { background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; }
    .tag-remove:hover { opacity: 1; }

    /* Toggle switch */
    .toggle-row { display: flex; justify-content: space-between; align-items: center; }
    .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; inset: 0; background: var(--bg-surface-hover);
      border: 1px solid var(--border-subtle); border-radius: 999px; cursor: pointer; transition: 0.3s; }
    .toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px;
      left: 2px; bottom: 2px; background: var(--text-muted); border-radius: 50%; transition: 0.3s; }
    .toggle-switch input:checked + .toggle-slider { background: var(--accent-primary); border-color: var(--accent-primary); }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); background: #fff; }

    /* Recurring preview */
    .recurring-preview { background: var(--bg-surface); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md); padding: var(--space-3); margin-top: var(--space-3); }
    .recur-preview-label { font-size: 0.75rem; color: var(--text-secondary); margin: 0 0 8px; }
    .recur-preview-dates { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .recur-date-chip { background: rgba(99,102,241,0.15); color: var(--accent-primary);
      font-size: 0.75rem; padding: 2px 10px; border-radius: 999px; }

    /* Receipt */
    .receipt-upload { border: 2px dashed var(--border-subtle); border-radius: var(--radius-md);
      padding: var(--space-4); text-align: center; cursor: pointer; transition: border-color 0.2s; }
    .receipt-upload:hover { border-color: var(--accent-primary); }
    .receipt-placeholder { display: flex; flex-direction: column; align-items: center;
      gap: var(--space-2); color: var(--text-secondary); font-size: 0.85rem; }
    .receipt-placeholder span:first-child { font-size: 2rem; }
    .receipt-preview { max-height: 120px; max-width: 100%; border-radius: var(--radius-md); object-fit: cover; }

    /* Split modal parts */
    #split-parts { display: flex; flex-direction: column; gap: var(--space-2); }
  `;
  document.head.appendChild(style);
}
