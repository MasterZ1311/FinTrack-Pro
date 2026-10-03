import { getAll, getById, add, update, getByIndex } from '../../db.js';
import store from '../../store.js';
import { formatCurrency, convert } from '../../services/currency.js';

const ACCOUNT_TYPES = {
  savings: { label: 'Savings Account', icon: '🏦' },
  checking: { label: 'Checking Account', icon: '🏧' },
  cash: { label: 'Cash Wallet', icon: '💵' },
  credit: { label: 'Credit Card', icon: '💳' },
  upi: { label: 'UPI Wallet', icon: '📱' },
  investment: { label: 'Investment Account', icon: '📈' },
  business: { label: 'Business Account', icon: '🏢' },
  pettycash: { label: 'Petty Cash', icon: '💰' }
};

let currentContainer = null;
let state = {
  accounts: [],
  selectedAccount: null, // For detail view
  isModalOpen: false,
  editingAccount: null
};

// ─── Exported Business Logic ──────────────────────────────────────────────────

export async function recalculateBalance(accountId) {
  try {
    const account = await getById('accounts', accountId);
    if (!account) return;

    let sourceTxs = [];
    let targetTxs = [];
    try {
      sourceTxs = await getByIndex('transactions', 'accountId', accountId);
    } catch {
      sourceTxs = [];
    }
    try {
      targetTxs = await getByIndex('transactions', 'toAccountId', accountId);
    } catch {
      targetTxs = [];
    }

    if (sourceTxs.length === 0 && targetTxs.length === 0) {
      const allTx = await getAll('transactions');
      sourceTxs = allTx.filter((t) => t.accountId === accountId);
      targetTxs = allTx.filter((t) => t.toAccountId === accountId);
    }

    const txMap = new Map();
    for (const tx of sourceTxs) txMap.set(tx.id, tx);
    for (const tx of targetTxs) txMap.set(tx.id, tx);

    const initialBalance = Number(account.initialBalance ?? account.openingBalance ?? 0);
    let balance = initialBalance;

    for (const tx of txMap.values()) {
      if (tx.isSplit === true) continue;

      if (tx.type === 'income') {
        balance += Number(tx.amount || 0);
      } else if (tx.type === 'expense') {
        balance -= Number(tx.amount || 0);
      } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId) {
          balance -= Number(tx.amount || 0);
        }
        if (tx.toAccountId === accountId) {
          const credited = (tx.targetAmount !== undefined && tx.targetAmount !== null)
            ? Number(tx.targetAmount)
            : Number(tx.amount || 0);
          balance += credited;
        }
      }
    }

    account.initialBalance = initialBalance;
    account.openingBalance = initialBalance;
    account.currentBalance = balance;
    account.balance = balance;
    account.updatedAt = Date.now();
    await update('accounts', account);

    // Refresh global store if needed
    const allAccounts = await getAll('accounts');
    store.setState('accounts', allAccounts);
  } catch (error) {
    console.error('[Accounts] Failed to recalculate balance:', error);
  }
}

export async function createTransfer(fromAccountId, toAccountId, amount, date, notes) {
  const fromAccount = await getById('accounts', fromAccountId);
  const toAccount = await getById('accounts', toAccountId);

  const fromCurrency = fromAccount?.currency || 'USD';
  const toCurrency = toAccount?.currency || fromCurrency;

  let targetAmount = amount;
  if (fromCurrency !== toCurrency) {
    targetAmount = convert(amount, fromCurrency, toCurrency);
  }

  const transferId = crypto.randomUUID();
  const now = Date.now();

  const fromTx = {
    id: crypto.randomUUID(),
    accountId: fromAccountId,
    type: 'expense',
    amount: amount,
    currency: fromCurrency,
    targetAmount: targetAmount,
    targetCurrency: toCurrency,
    date: date,
    category: 'Transfer',
    notes: notes,
    transferId: transferId,
    createdAt: now,
    updatedAt: now
  };

  const toTx = {
    id: crypto.randomUUID(),
    accountId: toAccountId,
    type: 'income',
    amount: targetAmount,
    currency: toCurrency,
    date: date,
    category: 'Transfer',
    notes: notes,
    transferId: transferId,
    createdAt: now,
    updatedAt: now
  };

  await add('transactions', fromTx);
  await add('transactions', toTx);

  await recalculateBalance(fromAccountId);
  await recalculateBalance(toAccountId);
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────

async function loadData() {
  const accounts = await getAll('accounts');
  const profile = store.getState('profile');
  
  // Filter by active profile if needed
  state.accounts = accounts.filter(a => !profile || a.profileId === profile.id);
  renderUI();
}

function renderUI() {
  if (!currentContainer) return;
  
  if (state.selectedAccount) {
    currentContainer.innerHTML = renderDetailView();
    attachDetailListeners();
  } else {
    currentContainer.innerHTML = `
      <div class="accounts-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
        <h1 style="margin:0; font-size: 2rem; font-weight: 700;">Accounts</h1>
        <button id="btn-add-account" class="btn btn-primary">
          + Add Account
        </button>
      </div>
      <div class="accounts-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
        ${state.accounts.map(renderAccountCard).join('')}
        
        <div id="card-add-account" style="border: 2px dashed var(--border-color, #ccc); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; cursor: pointer; min-height: 160px; transition: all 0.2s ease;">
          <span style="font-size: 2rem; color: var(--text-secondary, #666);">+</span>
          <p style="margin-top: 10px; color: var(--text-secondary, #666); font-weight: 500;">Add New Account</p>
        </div>
      </div>
      ${state.isModalOpen ? renderModal() : ''}
    `;
    attachListListeners();
  }
}

function renderAccountCard(account) {
  const typeInfo = ACCOUNT_TYPES[account.type] || ACCOUNT_TYPES['savings'];
  const icon = account.icon || typeInfo.icon;
  const color = account.color || '#007bff';
  const baseCurrency = store.getState('settings')?.baseCurrency || 'USD';
  
  // If account currency is different from base, we should ideally show base equivalent
  // For now, just format in account currency
  const formattedBalance = formatCurrency(account.currentBalance || 0, account.currency, store.getState('settings')?.locale);
  
  return `
    <div class="account-card" data-id="${account.id}" style="background: var(--bg-surface, #ffffff); border-radius: 16px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 6px solid ${color}; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: ${color}20; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            ${icon}
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary, #333);">${account.name}</h3>
            <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary, #666);">${account.institution || typeInfo.label}</p>
          </div>
        </div>
      </div>
      <div>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary, #666);">Current Balance</p>
        <h2 style="margin: 4px 0 0; font-size: 1.8rem; font-weight: 700; color: var(--text-primary, #111);">${formattedBalance}</h2>
      </div>
      ${account.accountNumber ? `<p style="margin: 12px 0 0; font-size: 0.8rem; color: var(--text-secondary, #999);">•••• ${account.accountNumber}</p>` : ''}
    </div>
  `;
}

function renderModal() {
  const isEdit = !!state.editingAccount;
  const acc = state.editingAccount || {};
  
  const typeOptions = Object.entries(ACCOUNT_TYPES).map(([val, info]) => 
    `<option value="${val}" ${acc.type === val ? 'selected' : ''}>${info.icon} ${info.label}</option>`
  ).join('');

  return `
    <div class="modal-backdrop" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div class="modal-content" style="background: var(--bg-surface, #fff); border-radius: 16px; padding: 32px; width: 100%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <h2 style="margin: 0 0 24px;">${isEdit ? 'Edit Account' : 'Add Account'}</h2>
        
        <form id="account-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Account Name</label>
            <input type="text" name="name" value="${acc.name || ''}" required style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; font-size: 1rem;">
          </div>
          
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Type</label>
              <select name="type" required style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; font-size: 1rem;">
                ${typeOptions}
              </select>
            </div>
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Color</label>
              <input type="color" name="color" value="${acc.color || '#007bff'}" style="width: 100%; height: 45px; padding: 2px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; cursor: pointer;">
            </div>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Institution / Bank Name (Optional)</label>
            <input type="text" name="institution" value="${acc.institution || ''}" style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; font-size: 1rem;">
          </div>
          
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Currency</label>
              <input type="text" name="currency" value="${acc.currency || store.getState('settings')?.baseCurrency || 'USD'}" required style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; font-size: 1rem;" placeholder="e.g. USD, INR">
            </div>
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Initial Balance</label>
              <input type="number" step="0.01" name="initialBalance" value="${acc.initialBalance || 0}" ${isEdit ? 'readonly' : ''} style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; font-size: 1rem; ${isEdit ? 'background: #f5f5f5;' : ''}">
            </div>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
            <button type="button" id="btn-cancel-modal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Account</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderDetailView() {
  const acc = state.selectedAccount;
  const formattedBalance = formatCurrency(acc.currentBalance || 0, acc.currency, store.getState('settings')?.locale);
  
  return `
    <div>
      <button id="btn-back" class="btn btn-ghost" style="margin-bottom: 24px;">&larr; Back to Accounts</button>
      
      <div style="background: var(--bg-surface, #fff); border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-top: 8px solid ${acc.color};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h1 style="margin: 0; font-size: 2.5rem;">${acc.name}</h1>
            <p style="margin: 8px 0 0; font-size: 1.1rem; color: var(--text-secondary, #666);">${acc.institution || ACCOUNT_TYPES[acc.type]?.label}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 1rem; color: var(--text-secondary, #666);">Current Balance</p>
            <h2 style="margin: 8px 0 0; font-size: 3rem; font-weight: 700;">${formattedBalance}</h2>
          </div>
        </div>
        
        <div style="display: flex; gap: 12px; margin-bottom: 32px;">
          <button id="btn-edit-account" class="btn btn-secondary">Edit Account</button>
          <button id="btn-transfer" class="btn btn-primary">Transfer Money</button>
        </div>
        
        <h3>Recent Transactions</h3>
        <p style="color: var(--text-secondary, #666);">Transactions list will be implemented by the transactions module.</p>
      </div>
    </div>
    ${state.isModalOpen ? renderModal() : ''}
  `;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function attachListListeners() {
  const btnAdd = document.getElementById('btn-add-account');
  const cardAdd = document.getElementById('card-add-account');
  
  const openModal = () => {
    state.isModalOpen = true;
    state.editingAccount = null;
    renderUI();
  };
  
  if (btnAdd) btnAdd.addEventListener('click', openModal);
  if (cardAdd) cardAdd.addEventListener('click', openModal);
  
  document.querySelectorAll('.account-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      state.selectedAccount = state.accounts.find(a => a.id === id);
      renderUI();
    });
  });
  
  attachModalListeners();
}

function attachDetailListeners() {
  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      state.selectedAccount = null;
      renderUI();
    });
  }
  
  const btnEdit = document.getElementById('btn-edit-account');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      state.isModalOpen = true;
      state.editingAccount = state.selectedAccount;
      renderUI();
    });
  }
  
  const btnTransfer = document.getElementById('btn-transfer');
  if (btnTransfer) {
    btnTransfer.addEventListener('click', () => {
      alert('Transfer functionality to be implemented in a dedicated modal/module.');
    });
  }
  
  attachModalListeners();
}

function attachModalListeners() {
  if (!state.isModalOpen) return;
  
  const form = document.getElementById('account-form');
  const btnCancel = document.getElementById('btn-cancel-modal');
  
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      state.isModalOpen = false;
      state.editingAccount = null;
      renderUI();
    });
  }
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const profile = store.getState('profile');
      
      const accountData = {
        name: formData.get('name'),
        type: formData.get('type'),
        color: formData.get('color'),
        institution: formData.get('institution'),
        currency: formData.get('currency').toUpperCase(),
        icon: ACCOUNT_TYPES[formData.get('type')]?.icon || '🏦',
        updatedAt: Date.now()
      };
      
      if (state.editingAccount) {
        Object.assign(state.editingAccount, accountData);
        await update('accounts', state.editingAccount);
        if (state.selectedAccount && state.selectedAccount.id === state.editingAccount.id) {
          state.selectedAccount = state.editingAccount;
        }
      } else {
        const initialBalance = parseFloat(formData.get('initialBalance')) || 0;
        const newAccount = {
          id: crypto.randomUUID(),
          profileId: profile?.id || 'default',
          ...accountData,
          initialBalance,
          openingBalance: initialBalance,
          currentBalance: initialBalance,
          balance: initialBalance,
          isDefault: state.accounts.length === 0,
          isActive: true,
          createdAt: Date.now()
        };
        await add('accounts', newAccount);
      }
      
      state.isModalOpen = false;
      state.editingAccount = null;
      await loadData(); // Re-fetch and re-render
    });
  }
}

// ─── Module Lifecycle ─────────────────────────────────────────────────────────

export default {
  render(container) {
    currentContainer = container;
    loadData();
  },
  destroy() {
    currentContainer = null;
    state.selectedAccount = null;
    state.isModalOpen = false;
    state.editingAccount = null;
  }
};
