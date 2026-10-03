/**
 * FinTrack Pro — Budgets Module
 * Budget management with progress rings, forecasting, and envelope budgeting.
 *
 * BUDGET SCHEMA:
 * {
 *   id, profileId, category, subcategory?,
 *   period: 'monthly'|'weekly'|'annual',
 *   amount, currency,
 *   startDate, endDate?,
 *   rollover: boolean,
 *   alertThresholds: [50, 75, 90, 100],
 *   createdAt, updatedAt
 * }
 *
 * Exported functions:
 *   getBudgetStatus(budgetId, periodStart, periodEnd) → { spent, remaining, percentage, forecast, status }
 *   checkAllBudgets() → alerts[]
 *   getMonthlyBudgetSummary() → { totalBudgeted, totalSpent, totalRemaining, categorySummaries[] }
 */

import { getAll, add as dbAdd, update as dbUpdate, remove as dbRemove } from '../../db.js';
import { store } from '../../store.js';
import { Icons } from '../../utils/icons.js';
import { CATEGORY_MAP } from '../transactions/categories.js';
import { calculateFinancialHealth, renderHealthScoreSVG } from '../ai/health-score.js';

// ─── Period Helpers ───────────────────────────────────────────────────────────

/**
 * Get the start and end of the current period for a budget.
 * @param {object} budget
 * @returns {{ start: string, end: string }} ISO date strings
 */
export function getCurrentPeriod(budget) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (budget.period) {
    case 'weekly': {
      const dayOfWeek = now.getDay(); // 0=Sun
      const start = new Date(now);
      start.setDate(d - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: _iso(start), end: _iso(end) };
    }
    case 'annual': {
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    case 'monthly':
    default: {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { start: _iso(start), end: _iso(end) };
    }
  }
}

function _iso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Budget Calculations ──────────────────────────────────────────────────────

/**
 * Calculate spending status for a budget over a date range.
 *
 * @param {string} budgetId
 * @param {string} periodStart - ISO date YYYY-MM-DD
 * @param {string} periodEnd   - ISO date YYYY-MM-DD
 * @returns {{
 *   spent: number,
 *   remaining: number,
 *   percentage: number,
 *   forecast: number,
 *   status: 'ok'|'warning'|'critical'|'exceeded',
 *   forecastMessage: string,
 *   daysInPeriod: number,
 *   daysElapsed: number,
 * }}
 */
export function getBudgetStatus(budgetId, periodStart, periodEnd) {
  const budget = store.state.budgets.find((b) => b.id === budgetId);
  if (!budget) return null;

  const transactions = store.state.transactions;

  // Sum expenses matching category in period
  const spent = transactions
    .filter((tx) => {
      if (tx.isSplit) return false;
      if (tx.type !== 'expense') return false;
      if (tx.category !== budget.category) return false;
      if (budget.subcategory && tx.subcategory !== budget.subcategory) return false;
      return tx.date >= periodStart && tx.date <= periodEnd;
    })
    .reduce((sum, tx) => sum + (tx.convertedAmount ?? tx.amount), 0);

  const budgetAmount = budget.amount + (budget._rolloverCarryover || 0);
  const remaining = budgetAmount - spent;
  const percentage = budgetAmount > 0 ? Math.min((spent / budgetAmount) * 100, 999) : 0;

  // Forecast: extrapolate current spend rate to full period
  const today = _iso(new Date());
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const todayDate = new Date(Math.min(new Date(today), end));

  const daysInPeriod = Math.ceil((end - start) / 86400000) + 1;
  const daysElapsed = Math.ceil((todayDate - start) / 86400000) + 1;
  const dailyRate = daysElapsed > 0 ? spent / daysElapsed : 0;
  const forecast = dailyRate * daysInPeriod;
  const forecastOver = forecast - budgetAmount;

  let status = 'ok';
  if (percentage >= 100) status = 'exceeded';
  else if (percentage >= 90) status = 'critical';
  else if (percentage >= 75) status = 'warning';

  let forecastMessage = 'On track';
  if (forecastOver > 0 && percentage < 100) {
    forecastMessage = `Will exceed by ${_fmt(forecastOver)} at current rate`;
  } else if (percentage >= 100) {
    forecastMessage = `Exceeded by ${_fmt(Math.abs(remaining))}`;
  }

  return { spent, remaining, percentage, forecast, status, forecastMessage, daysInPeriod, daysElapsed };
}

/**
 * Check all budgets for threshold breaches. Returns alerts array.
 * Also pushes toast notifications for newly exceeded budgets.
 *
 * @returns {Array<{budget: object, status: object, alert: string}>}
 */
export function checkAllBudgets() {
  const budgets = store.state.budgets;
  const alerts = [];

  for (const budget of budgets) {
    const { start, end } = getCurrentPeriod(budget);
    const status = getBudgetStatus(budget.id, start, end);
    if (!status) continue;

    const thresholds = budget.alertThresholds ?? [50, 75, 90, 100];
    for (const threshold of thresholds) {
      if (status.percentage >= threshold) {
        const catLabel = CATEGORY_MAP[budget.category]?.label ?? budget.category;
        const catIcon = CATEGORY_MAP[budget.category]?.icon ?? Icons.money;
        let alertMsg;

        if (threshold === 100) {
          alertMsg = `${catIcon} ${catLabel} budget exceeded! Spent ${_fmt(status.spent)} of ${_fmt(budget.amount)}`;
        } else {
          alertMsg = `${catIcon} ${catLabel} budget at ${Math.round(status.percentage)}% (${_fmt(status.spent)} of ${_fmt(budget.amount)})`;
        }

        // Only notify if this is new (check last notified threshold in budget)
        const lastNotified = budget._lastNotifiedThreshold || 0;
        if (threshold > lastNotified) {
          store.notify({
            type: threshold >= 100 ? 'error' : 'warning',
            message: alertMsg,
            duration: 8000,
          });
          // Update budget to record last threshold (non-persistent, in-memory)
          budget._lastNotifiedThreshold = threshold;
        }

        alerts.push({ budget, status, alert: alertMsg, threshold });
        break; // only highest threshold per budget
      }
    }
  }

  store.setState('notifications', store.state.notifications); // trigger re-render
  return alerts;
}

/**
 * Get a monthly budget summary for the dashboard widget.
 *
 * @returns {{
 *   totalBudgeted: number,
 *   totalSpent: number,
 *   totalRemaining: number,
 *   categorySummaries: Array<{budget, status, catLabel, catIcon}>
 * }}
 */
export function getMonthlyBudgetSummary() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const periodStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const periodEnd = _iso(new Date(y, m + 1, 0));

  const budgets = store.state.budgets.filter((b) => b.period === 'monthly');

  let totalBudgeted = 0;
  let totalSpent = 0;
  const categorySummaries = [];

  for (const budget of budgets) {
    totalBudgeted += budget.amount;
    const status = getBudgetStatus(budget.id, periodStart, periodEnd);
    if (status) {
      totalSpent += status.spent;
      categorySummaries.push({
        budget,
        status,
        catLabel: CATEGORY_MAP[budget.category]?.label ?? budget.category,
        catIcon: CATEGORY_MAP[budget.category]?.icon ?? Icons.money,
      });
    }
  }

  categorySummaries.sort((a, b) => b.status.percentage - a.status.percentage);

  return {
    totalBudgeted,
    totalSpent,
    totalRemaining: totalBudgeted - totalSpent,
    categorySummaries,
  };
}

// ─── Envelope Budgeting ───────────────────────────────────────────────────────

/**
 * Get envelope budgeting summary for current month.
 * Total Income → allocate to envelopes → show unallocated.
 *
 * @returns {{ totalIncome, totalAllocated, unallocated, envelopes[] }}
 */
export function getEnvelopeSummary() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const periodStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const periodEnd = _iso(new Date(y, m + 1, 0));

  const transactions = store.state.transactions;

  const totalIncome = transactions
    .filter((tx) => !tx.isSplit && tx.type === 'income' && tx.date >= periodStart && tx.date <= periodEnd)
    .reduce((s, tx) => s + (tx.convertedAmount ?? tx.amount), 0);

  const budgets = store.state.budgets.filter((b) => b.period === 'monthly');
  const totalAllocated = budgets.reduce((s, b) => s + b.amount, 0);
  const unallocated = totalIncome - totalAllocated;

  const envelopes = budgets.map((budget) => {
    const status = getBudgetStatus(budget.id, periodStart, periodEnd);
    return {
      budget,
      status,
      catLabel: CATEGORY_MAP[budget.category]?.label ?? budget.category,
      catIcon: CATEGORY_MAP[budget.category]?.icon ?? Icons.money,
    };
  });

  return { totalIncome, totalAllocated, unallocated, envelopes };
}

// ─── Format Helper ────────────────────────────────────────────────────────────

function _fmt(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

// ─── SVG Progress Ring ────────────────────────────────────────────────────────

function progressRing(percentage, size = 64, status = 'ok') {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const clampedPct = Math.min(percentage, 100);
  const offset = circumference - (clampedPct / 100) * circumference;

  const COLOR_MAP = {
    ok: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    exceeded: '#dc2626',
  };
  const color = COLOR_MAP[status] || '#10b981';

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="progress-ring">
      <circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="rgba(255,255,255,0.06)" stroke-width="6" fill="none"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="${color}" stroke-width="6" fill="none"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}"
        stroke-linecap="round"
        style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 0.6s ease"/>
    </svg>
  `;
}

// ─── Budget Card ──────────────────────────────────────────────────────────────

function renderBudgetCard(budget, status) {
  const cat = CATEGORY_MAP[budget.category];
  const icon = cat?.icon ?? Icons.money;
  const label = cat?.label ?? budget.category;
  const pct = Math.round(status?.percentage ?? 0);
  const statusLabel = status?.status ?? 'ok';
  const COLOR = { ok: 'var(--accent-success)', warning: 'var(--accent-warning)', critical: 'var(--accent-danger)', exceeded: 'var(--accent-danger)' };
  const remainColor = (status?.remaining ?? 0) >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';

  return `
    <div class="budget-card glass-card" data-budget-id="${budget.id}">
      <div class="budget-card-header">
        <div class="budget-icon-label">
          <span class="budget-cat-icon" style="background:${cat?.colorHex ?? 'rgba(148,163,184,0.15)'}">${icon}</span>
          <div>
            <div class="budget-label">${label}</div>
            <div class="budget-period">${budget.period.charAt(0).toUpperCase() + budget.period.slice(1)}</div>
          </div>
        </div>
        <div class="budget-ring-wrapper">
          ${progressRing(pct, 64, statusLabel)}
          <span class="budget-pct-text" style="color:${COLOR[statusLabel]}">${pct}%</span>
        </div>
      </div>

      <div class="budget-progress-bar-track">
        <div class="budget-progress-bar-fill"
          style="width:${Math.min(pct, 100)}%;background:${COLOR[statusLabel]}"></div>
      </div>

      <div class="budget-amounts">
        <div>
          <div class="budget-amount-label">Spent</div>
          <div class="budget-amount-val">${_fmt(status?.spent ?? 0)}</div>
        </div>
        <div style="text-align:center">
          <div class="budget-amount-label">Budget</div>
          <div class="budget-amount-val">${_fmt(budget.amount)}</div>
        </div>
        <div style="text-align:right">
          <div class="budget-amount-label">Remaining</div>
          <div class="budget-amount-val" style="color:${remainColor}">${_fmt(status?.remaining ?? budget.amount)}</div>
        </div>
      </div>

      <div class="budget-forecast ${statusLabel}">
        <span>${statusLabel === 'ok' ? Icons.success : statusLabel === 'warning' ? Icons.warning : Icons.danger}</span>
        <span>${status?.forecastMessage ?? 'On track'}</span>
      </div>

      <div class="budget-card-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${budget.id}">${Icons.edit} Edit</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${budget.id}">${Icons.delete} Delete</button>
      </div>
    </div>
  `;
}

// ─── Add/Edit Budget Modal ────────────────────────────────────────────────────

import { ALL_CATEGORIES } from '../transactions/categories.js';

function openBudgetModal(budget = {}, isEdit = false, onSave) {
  const catOptions = ALL_CATEGORIES.filter((c) => c.type === 'expense')
    .map((c) => `<option value="${c.id}" ${c.id === budget.category ? 'selected' : ''}>${c.icon} ${c.label}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div class="modal-overlay" id="budget-modal-overlay">
      <div class="modal-content" style="max-width:480px">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit Budget' : 'Add Budget'}</h2>
          <button class="btn btn-ghost" id="budget-modal-close">✕</button>
        </div>
        <form id="budget-form" novalidate>
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="select-field" id="budget-category" required>
              <option value="">Select category</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Budget Amount *</label>
            <div style="position:relative">
              <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-weight:600">₹</span>
              <input type="number" class="input-field" id="budget-amount"
                style="padding-left:32px" value="${budget.amount || ''}" min="1" step="1" required placeholder="0">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Period</label>
            <div class="type-toggle-group" id="budget-period-toggle">
              ${['monthly','weekly','annual'].map((p) => `
                <button type="button" class="type-toggle-btn ${(budget.period ?? 'monthly') === p ? 'active' : ''}"
                  data-period="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <div class="toggle-row">
              <label class="form-label" for="budget-rollover">Rollover unused budget</label>
              <label class="toggle-switch">
                <input type="checkbox" id="budget-rollover" ${budget.rollover ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <p style="color:var(--text-muted);font-size:0.75rem;margin-top:4px">Unspent amount carries forward to next period</p>
          </div>
          <div class="form-error" id="budget-form-error" style="display:none"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="budget-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Budget'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const el = overlay.firstElementChild;
  document.body.appendChild(el);

  let selectedPeriod = budget.period ?? 'monthly';

  // Period toggle
  el.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPeriod = btn.dataset.period;
      el.querySelectorAll('[data-period]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const close = () => el.remove();
  el.querySelector('#budget-modal-close').onclick = close;
  el.querySelector('#budget-cancel').onclick = close;
  el.querySelector('#budget-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'budget-modal-overlay') close();
  });

  el.querySelector('#budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = el.querySelector('#budget-form-error');
    const category = el.querySelector('#budget-category').value;
    const amount = parseFloat(el.querySelector('#budget-amount').value || '0');
    const rollover = el.querySelector('#budget-rollover').checked;

    if (!category) { errorEl.textContent = 'Category is required'; errorEl.style.display = 'block'; return; }
    if (!amount || amount <= 0) { errorEl.textContent = 'Amount must be greater than 0'; errorEl.style.display = 'block'; return; }

    const now = new Date().toISOString();
    const data = {
      ...(isEdit ? budget : {}),
      id: isEdit ? budget.id : crypto.randomUUID(),
      profileId: store.state.profile?.id || '',
      category,
      period: selectedPeriod,
      amount,
      currency: store.state.settings?.currency || 'INR',
      rollover,
      alertThresholds: [50, 75, 90, 100],
      startDate: budget.startDate || now.slice(0, 10),
      createdAt: budget.createdAt || now,
      updatedAt: now,
    };

    try {
      if (isEdit) {
        await dbUpdate('budgets', data);
      } else {
        await dbAdd('budgets', data);
      }
      const allBudgets = await getAll('budgets');
      store.setState('budgets', allBudgets);
      close();
      onSave?.();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });
}

// ─── Envelope View ────────────────────────────────────────────────────────────

function renderEnvelopeView(container) {
  const { totalIncome, totalAllocated, unallocated, envelopes } = getEnvelopeSummary();
  const unallocColor = unallocated >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';

  container.innerHTML = `
    <div class="envelope-summary glass-card">
      <h2 class="section-title">${Icons.envelope} Envelope Budgeting</h2>
      <div class="envelope-totals">
        <div class="envelope-total-item">
          <div class="envelope-total-label">Monthly Income</div>
          <div class="envelope-total-val">${_fmt(totalIncome)}</div>
        </div>
        <div class="envelope-total-item">
          <div class="envelope-total-label">Allocated</div>
          <div class="envelope-total-val">${_fmt(totalAllocated)}</div>
        </div>
        <div class="envelope-total-item">
          <div class="envelope-total-label">Unallocated</div>
          <div class="envelope-total-val" style="color:${unallocColor}">${_fmt(unallocated)}</div>
        </div>
      </div>
      ${unallocated < 0
        ? `<div class="envelope-warning">${Icons.warning} You've allocated more than your income by ${_fmt(Math.abs(unallocated))}</div>`
        : unallocated > 0
        ? `<div class="envelope-info">💡 ${_fmt(unallocated)} still unallocated — consider adding more budgets</div>`
        : `<div class="envelope-success">${Icons.success} Income fully allocated!</div>`
      }
    </div>
    <div class="budget-grid">
      ${envelopes.map(({ budget, status, catLabel, catIcon }) => renderBudgetCard(budget, status)).join('')}
    </div>
  `;
}

// ─── Main Render ──────────────────────────────────────────────────────────────

let budgetUnsubscribe = null;

export default {
  /**
   * Render the full budgets page into the given container.
   * @param {HTMLElement} container
   */
  async render(container) {
    injectBudgetStyles();

    const renderPage = (activeTab = 'budgets') => {
      const budgets = store.state.budgets;
      const transactions = store.state.transactions || [];
      const healthData = calculateFinancialHealth(transactions);
      const healthScoreHtml = renderHealthScoreSVG(healthData.score);

      container.innerHTML = `
        <div class="budgets-page">
          <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-5);">
            <div>
              <h1 class="page-title">Budgets</h1>
              <p class="page-subtitle">Stay on top of your spending limits</p>
              <div style="margin-top: 24px;">
                ${healthScoreHtml}
              </div>
            </div>
            <button class="btn btn-primary" id="add-budget-btn">+ New Budget</button>
          </div>

          <!-- Tab Toggle -->
          <div class="type-toggle-group" id="budget-tab-group" style="max-width:320px;margin-bottom:var(--space-5)">
            <button class="type-toggle-btn ${activeTab === 'budgets' ? 'active' : ''}" data-tab="budgets">${Icons.emptyChart} Budgets</button>
            <button class="type-toggle-btn ${activeTab === 'envelopes' ? 'active' : ''}" data-tab="envelopes">${Icons.envelope} Envelopes</button>
          </div>

          <div id="budget-tab-content">
            ${activeTab === 'budgets' ? renderBudgetsTab(budgets) : ''}
          </div>
        </div>
      `;

      if (activeTab === 'envelopes') {
        renderEnvelopeView(container.querySelector('#budget-tab-content'));
      }

      // Tab switching
      container.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          renderPage(btn.dataset.tab);
        });
      });

      // Add budget
      container.querySelector('#add-budget-btn')?.addEventListener('click', () => {
        openBudgetModal({}, false, () => renderPage(activeTab));
      });

      // Budget card actions
      container.querySelectorAll('.budget-card-actions button').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const { action, id } = btn.dataset;
          const budget = store.state.budgets.find((b) => b.id === id);
          if (!budget) return;

          if (action === 'edit') {
            openBudgetModal(budget, true, () => renderPage(activeTab));
          } else if (action === 'delete') {
            if (confirm(`Delete "${CATEGORY_MAP[budget.category]?.label ?? budget.category}" budget?`)) {
              await dbRemove('budgets', id);
              const all = await getAll('budgets');
              store.setState('budgets', all);
              renderPage(activeTab);
            }
          }
        });
      });
    };

    renderPage();

    budgetUnsubscribe = store.subscribe('budgets', () => {
      const activeTab = container.querySelector('[data-tab].active')?.dataset.tab ?? 'budgets';
      renderPage(activeTab);
    });
    store.subscribe('transactions', () => {
      const activeTab = container.querySelector('[data-tab].active')?.dataset.tab ?? 'budgets';
      renderPage(activeTab);
    });
  },

  destroy() {
    budgetUnsubscribe?.();
  },
};

function renderBudgetsTab(budgets) {
  if (budgets.length === 0) {
    return `
      <div class="tx-empty-state">
        <div class="empty-illustration">${Icons.emptyChart}</div>
        <h3>No budgets yet</h3>
        <p>Create your first budget to start tracking your spending limits</p>
      </div>
    `;
  }

  const budgetsWithStatus = budgets.map((budget) => {
    const { start, end } = getCurrentPeriod(budget);
    const status = getBudgetStatus(budget.id, start, end);
    return { budget, status };
  });

  return `<div class="budget-grid">
    ${budgetsWithStatus.map(({ budget, status }) => renderBudgetCard(budget, status)).join('')}
  </div>`;
}

// ─── CSS Injection ────────────────────────────────────────────────────────────

function injectBudgetStyles() {
  if (document.getElementById('budget-module-styles')) return;
  const style = document.createElement('style');
  style.id = 'budget-module-styles';
  style.textContent = `
    .budgets-page { padding: var(--space-6); max-width: 1200px; margin: 0 auto; }

    .budget-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4); }

    .budget-card { padding: var(--space-5); position: relative; }
    .budget-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4); }
    .budget-icon-label { display: flex; align-items: center; gap: var(--space-3); }
    .budget-cat-icon { width: 44px; height: 44px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
    .budget-label { font-weight: 600; color: var(--text-primary); font-size: 1rem; }
    .budget-period { font-size: 0.75rem; color: var(--text-muted); text-transform: capitalize; }
    .budget-ring-wrapper { position: relative; display: flex; align-items: center; justify-content: center; }
    .budget-pct-text { position: absolute; font-size: 0.7rem; font-weight: 700; }

    .budget-progress-bar-track { height: 6px; background: rgba(255,255,255,0.06);
      border-radius: 999px; overflow: hidden; margin-bottom: var(--space-3); }
    .budget-progress-bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }

    .budget-amounts { display: flex; justify-content: space-between; margin-bottom: var(--space-3); }
    .budget-amount-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .budget-amount-val { font-weight: 600; font-size: 0.9rem; color: var(--text-primary); }

    .budget-forecast { display: flex; align-items: center; gap: var(--space-2);
      font-size: 0.8rem; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-3); }
    .budget-forecast.ok { background: rgba(16,185,129,0.1); color: var(--accent-success); }
    .budget-forecast.warning { background: rgba(245,158,11,0.1); color: var(--accent-warning); }
    .budget-forecast.critical, .budget-forecast.exceeded { background: rgba(239,68,68,0.1); color: var(--accent-danger); }

    .budget-card-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
    .btn-sm { padding: var(--space-1) var(--space-3) !important; font-size: 0.8rem !important; }

    /* Envelope */
    .envelope-summary { margin-bottom: var(--space-5); }
    .section-title { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 var(--space-4); }
    .envelope-totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-4); }
    .envelope-total-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .envelope-total-val { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
    .envelope-warning { background: rgba(245,158,11,0.1); color: var(--accent-warning); padding: var(--space-3); border-radius: var(--radius-md); font-size: 0.875rem; }
    .envelope-info { background: rgba(6,182,212,0.1); color: var(--accent-tertiary); padding: var(--space-3); border-radius: var(--radius-md); font-size: 0.875rem; }
    .envelope-success { background: rgba(16,185,129,0.1); color: var(--accent-success); padding: var(--space-3); border-radius: var(--radius-md); font-size: 0.875rem; }

    /* Reuse from tx module */
    .form-group { margin-bottom: var(--space-4); }
    .form-label { display: block; font-size: 0.8rem; font-weight: 600;
      color: var(--text-secondary); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.05em; }
    .toggle-row { display: flex; justify-content: space-between; align-items: center; }
    .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; inset: 0; background: var(--bg-surface-hover);
      border: 1px solid var(--border-subtle); border-radius: 999px; cursor: pointer; transition: 0.3s; }
    .toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px;
      left: 2px; bottom: 2px; background: var(--text-muted); border-radius: 50%; transition: 0.3s; }
    .toggle-switch input:checked + .toggle-slider { background: var(--accent-primary); border-color: var(--accent-primary); }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); background: #fff; }
    .type-toggle-group { display: flex; gap: 0; background: var(--bg-surface);
      border: var(--glass-border); border-radius: var(--radius-md); padding: 4px; margin-bottom: var(--space-5); }
    .type-toggle-btn { flex: 1; padding: var(--space-2); background: none; border: none;
      color: var(--text-secondary); font-family: var(--font-sans); font-size: 0.875rem;
      font-weight: 500; cursor: pointer; border-radius: var(--radius-sm); transition: all 0.2s; }
    .type-toggle-btn.active { background: var(--accent-primary); color: #fff;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); }
    .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0; }
    .modal-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-5);
      padding-top: var(--space-4); border-top: 1px solid var(--border-subtle); }
    .form-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      color: var(--accent-danger); padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md); font-size: 0.875rem; margin-top: var(--space-3); }
    .tx-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px var(--space-6); text-align: center; gap: var(--space-4); }
    .empty-illustration { font-size: 4rem; line-height: 1; }
    .tx-empty-state h3 { font-size: 1.25rem; color: var(--text-primary); margin: 0; }
    .tx-empty-state p { color: var(--text-secondary); margin: 0; }
    .page-title { font-size: 1.875rem; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 var(--space-5); }
  `;
  document.head.appendChild(style);
}
