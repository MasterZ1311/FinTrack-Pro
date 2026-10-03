import { store } from '../../store.js';
import { openModal } from '../transactions/index.js';
import { CATEGORY_MAP } from '../transactions/categories.js';

let unsubscribe = null;

function formatCurrency(amount) {
  const settings = store.state.settings || {};
  const locale = settings.locale || 'en-IN';
  const currency = settings.baseCurrency || 'INR';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    return `₹${Number(amount || 0).toFixed(2)}`;
  }
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function calculateKPIs(transactions, accounts) {
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance ?? acc.balance ?? 0), 0);
  
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
  
  let incomeThisMonth = 0;
  let expensesThisMonth = 0;
  
  for (const tx of transactions) {
    if (tx.isSplit) continue;
    if (tx.date && tx.date.startsWith(currentMonthStr)) {
      if (tx.type === 'income') incomeThisMonth += Number(tx.amount || 0);
      if (tx.type === 'expense') expensesThisMonth += Number(tx.amount || 0);
    }
  }
  
  let savingsRate = 0;
  if (incomeThisMonth > 0) {
    savingsRate = Math.max(0, ((incomeThisMonth - expensesThisMonth) / incomeThisMonth) * 100);
  }
  
  return {
    totalBalance,
    incomeThisMonth,
    expensesThisMonth,
    savingsRate: savingsRate.toFixed(1),
  };
}

function renderRecentTransactions(transactions) {
  const recent = [...transactions].filter((tx) => !tx.isSplit).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  
  if (recent.length === 0) {
    return `
      <div class="empty-state-card">
        <div class="empty-icon">💳✨</div>
        <h4>Your financial ledger is currently spotless</h4>
        <p>Record your income receipts, daily expenses, or transfers to begin visualizing cashflow patterns and AI financial insights.</p>
        <button id="btn-record-first-tx" class="btn btn-primary">
          + Record First Transaction
        </button>
      </div>
    `;
  }
  
  return `<div style="display:flex; flex-direction:column; gap: var(--space-2);">` + recent.map(tx => {
    const isExpense = tx.type === 'expense';
    const isIncome = tx.type === 'income';
    const amountColor = isIncome ? '#34d399' : isExpense ? '#fb7185' : '#818cf8';
    const prefix = isIncome ? '+' : isExpense ? '−' : '⇄';
    const cat = CATEGORY_MAP[tx.category];
    const catName = cat?.label || tx.category || 'Transfer';
    const catIcon = cat?.icon || (isIncome ? '💵' : isExpense ? '🛍️' : '🔄');
    const catColor = cat?.colorHex ? `${cat.colorHex}25` : 'rgba(129, 140, 248, 0.15)';
    
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--space-3) var(--space-4); background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); transition: background 0.2s ease, transform 0.2s ease; cursor: default;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'">
        <div style="display:flex; align-items:center; gap: var(--space-3);">
          <div style="width: 46px; height: 46px; border-radius: var(--radius-md); display:flex; align-items:center; justify-content:center; background: ${catColor}; font-size: 1.4rem; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);">
            ${catIcon}
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.98rem; color: var(--text-primary);">${tx.description || tx.merchant || 'Transaction'}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              ${catName} • ${new Date(tx.date).toLocaleDateString(store.state.settings?.locale || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div style="font-weight: 700; font-size: 1.05rem; color: ${amountColor}; font-family: var(--font-mono, monospace);">
          ${prefix}${formatCurrency(tx.amount)}
        </div>
      </div>
    `;
  }).join('') + `</div>`;
}

function renderBudgetOverview(transactions, budgets) {
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  
  const categoryExpenses = {};
  for (const tx of transactions) {
    if (tx.isSplit) continue;
    if (tx.type === 'expense' && tx.date && tx.date.startsWith(currentMonthStr)) {
      categoryExpenses[tx.category] = (categoryExpenses[tx.category] || 0) + Number(tx.amount || 0);
    }
  }
  
  let topItems = [];
  if (budgets && budgets.length > 0) {
    topItems = budgets.map(b => {
      const spent = categoryExpenses[b.categoryId] || 0;
      return {
        id: b.categoryId,
        spent,
        limit: b.amount,
        percentage: Math.min(100, (spent / b.amount) * 100)
      };
    }).sort((a, b) => b.spent - a.spent).slice(0, 3);
  } else {
    topItems = Object.entries(categoryExpenses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, spent]) => {
        const limit = spent > 0 ? spent * 1.3 : 100;
        return {
          id,
          spent,
          limit,
          percentage: Math.min(100, (spent / limit) * 100)
        };
      });
  }
  
  if (topItems.length === 0) {
    return `
      <div class="empty-state-card" style="padding: var(--space-6) var(--space-4);">
        <div class="empty-icon" style="font-size: 2.6rem;">🎯</div>
        <h4>No spending caps defined</h4>
        <p>Set budget envelopes for categories like Dining and Utilities to prevent overspending and enable AI alerts.</p>
        <a href="#/budgets" class="btn btn-secondary" style="text-decoration: none; margin-top: var(--space-2);">
          Configure Budgets &rarr;
        </a>
      </div>
    `;
  }
  
  return `<div style="display:flex; justify-content:space-around; flex-wrap:wrap; gap: var(--space-4); padding: var(--space-2) 0;">` +
    topItems.map(item => {
      const cat = CATEGORY_MAP[item.id];
      const catName = cat?.label || item.id;
      const radius = 38;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (item.percentage / 100) * circumference;
      const color = item.percentage > 90 ? '#f43f5e' : item.percentage > 75 ? '#f59e0b' : '#3b82f6';
      
      return `
        <div style="display:flex; flex-direction:column; align-items:center; gap: var(--space-2); min-width: 110px; background: rgba(0, 0, 0, 0.15); padding: var(--space-4) var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
          <div style="position:relative; width:88px; height:88px;">
            <svg class="progress-ring" width="88" height="88" style="transform:rotate(-90deg);">
              <circle cx="44" cy="44" r="${radius}" fill="transparent" stroke="rgba(255, 255, 255, 0.08)" stroke-width="6"/>
              <circle cx="44" cy="44" r="${radius}" fill="transparent" stroke="${color}" stroke-width="6" 
                stroke-dasharray="${circumference} ${circumference}" 
                stroke-dashoffset="${offset}" 
                stroke-linecap="round" 
                style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);"/>
            </svg>
            <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.6rem;">
              ${cat?.icon || '📦'}
            </div>
          </div>
          <div style="text-align:center; width: 100%;">
            <div style="font-size:0.9rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${catName}</div>
            <div style="font-size:0.75rem; color: ${color}; font-weight: 600; margin-top: 2px;">${Math.round(item.percentage)}% consumed</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${formatCurrency(item.spent)}</div>
          </div>
        </div>
      `;
    }).join('') + `</div>`;
}

export function renderDashboard(container) {
  const { transactions = [], accounts = [], budgets = [], profile } = store.state;
  const kpis = calculateKPIs(transactions, accounts);
  const userName = profile ? (profile.name || profile.companyName || 'Pro User') : 'Pro User';
  const monthName = new Date().toLocaleDateString(store.state.settings?.locale || 'en-IN', { month: 'long', year: 'numeric' });

  container.innerHTML = `
    <div class="dashboard-layout">
      <!-- Hero Greeting Banner -->
      <div class="dashboard-hero">
        <div class="hero-content">
          <h2>✨ Good ${getTimeOfDay()}, ${userName}</h2>
          <p>Welcome to your financial command center. Track liquidity across active accounts, monitor spending velocity, and leverage AI financial diagnostics in real time.</p>
        </div>
        <div class="hero-actions">
          <button id="hero-quick-add" class="btn btn-primary" style="box-shadow: 0 0 24px rgba(129, 140, 248, 0.45);">+ New Transaction</button>
          <a href="#/ai" class="btn btn-secondary" style="text-decoration: none;">🤖 AI Advisor</a>
        </div>
      </div>

      <!-- KPI Summary Row -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Net Liquidity</span>
            <div class="kpi-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">🏦</div>
          </div>
          <div class="kpi-value" style="color: ${kpis.totalBalance >= 0 ? '#34d399' : '#fb7185'};">
            ${formatCurrency(kpis.totalBalance)}
          </div>
          <div class="kpi-footer">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#34d399;"></span>
            <span>Across ${accounts.length} active account${accounts.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Inflows (${new Date().toLocaleString('default', { month: 'short' })})</span>
            <div class="kpi-icon" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">📈</div>
          </div>
          <div class="kpi-value" style="color: #60a5fa;">
            ${formatCurrency(kpis.incomeThisMonth)}
          </div>
          <div class="kpi-footer">
            <span>Monthly realized earnings</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Outflow (${new Date().toLocaleString('default', { month: 'short' })})</span>
            <div class="kpi-icon" style="background: rgba(244, 63, 94, 0.15); color: #fb7185;">📉</div>
          </div>
          <div class="kpi-value" style="color: #fb7185;">
            ${formatCurrency(kpis.expensesThisMonth)}
          </div>
          <div class="kpi-footer">
            <span>Total monthly expenses</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Savings Efficiency</span>
            <div class="kpi-icon" style="background: rgba(192, 132, 252, 0.15); color: #c084fc;">💎</div>
          </div>
          <div class="kpi-value" style="color: ${Number(kpis.savingsRate) > 20 ? '#c084fc' : '#fbbf24'};">
            ${kpis.savingsRate}%
          </div>
          <div class="kpi-footer">
            <span>Target: >20% retained</span>
          </div>
        </div>
      </div>
      
      <!-- Main Content Grid -->
      <div class="dashboard-main-grid">
        <!-- Left: Recent Activity Ledger -->
        <div class="dashboard-section-card">
          <div class="section-header">
            <h3><span>💳</span> Recent Ledger Activity</h3>
            <a href="#/transactions" style="color: var(--accent-primary); text-decoration: none; font-size: 0.88rem; font-weight: 600; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">View Full Ledger &rarr;</a>
          </div>
          <div style="margin-top: var(--space-2);">
            ${renderRecentTransactions(transactions)}
          </div>
        </div>
        
        <!-- Right: Budget Envelopes & AI Quick Pulse -->
        <div style="display:flex; flex-direction:column; gap: var(--space-6);">
          <div class="dashboard-section-card">
            <div class="section-header">
              <h3><span>🎯</span> Budget Allocation</h3>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${monthName}</span>
            </div>
            ${renderBudgetOverview(transactions, budgets)}
          </div>

          <div class="dashboard-section-card" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%); border-color: rgba(99, 102, 241, 0.25);">
            <div class="section-header" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <h3><span>⚡</span> Financial Pulse</h3>
              <span class="badge" style="background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.4);">LIVE</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.6; margin: 0;">
              💡 <strong>Pro Tip:</strong> Link your recurring utility bills and investment SIPs in FinTrack Pro to receive predictive AI insights and automated cashflow forecasts.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Floating Action Button (FAB) -->
      <button id="quick-add-btn" title="Record Transaction" style="position:fixed; bottom:var(--space-6); right:var(--space-6); width:62px; height:62px; border-radius:50%; background:linear-gradient(135deg, var(--accent-primary, #6366f1), var(--accent-secondary, #c084fc)); color:#fff; border:none; box-shadow: 0 6px 25px rgba(99, 102, 241, 0.6); display:flex; align-items:center; justify-content:center; font-size:1.8rem; cursor:pointer; z-index:90; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;">
        +
      </button>
    </div>
  `;
  
  const wireButton = (id, handler) => {
    const btn = container.querySelector(id);
    if (btn) btn.addEventListener('click', handler);
  };

  wireButton('#hero-quick-add', () => openModal());
  wireButton('#btn-record-first-tx', () => openModal());
  
  const quickAddBtn = container.querySelector('#quick-add-btn');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => openModal());
    quickAddBtn.addEventListener('mouseover', () => {
      quickAddBtn.style.transform = 'scale(1.1) rotate(90deg)';
      quickAddBtn.style.boxShadow = '0 8px 32px rgba(192, 132, 252, 0.8)';
    });
    quickAddBtn.addEventListener('mouseout', () => {
      quickAddBtn.style.transform = 'scale(1) rotate(0deg)';
      quickAddBtn.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.6)';
    });
  }
}

export default {
  render(container) {
    renderDashboard(container);
    
    unsubscribe = store.subscribeAll((key) => {
      if (['transactions', 'accounts', 'budgets', 'profile', 'settings'].includes(key)) {
        renderDashboard(container);
      }
    });
  },
  destroy() {
    if (unsubscribe) unsubscribe();
  }
};
