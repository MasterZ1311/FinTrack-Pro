import { store } from '../../store.js';
import { CATEGORY_MAP } from '../transactions/categories.js';
import Chart from 'chart.js/auto';

let currentCharts = {};
let unsubscribe = null;

// Helper to get CSS variables for Chart.js
function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getDateRange(rangeType) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (rangeType === 'this_month') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start, end };
  } else if (rangeType === 'last_month') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start, end };
  } else if (rangeType === 'this_year') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { start, end };
  }
  return null;
}

function updateCharts(dateRangeType) {
  const transactions = store.state.transactions;
  const { start, end } = getDateRange(dateRangeType);
  
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  
  const filteredTxs = transactions.filter(tx => !tx.isSplit && tx.date >= startStr && tx.date <= endStr);
  
  // 1. Income vs Expense Trend (6 months fixed, ending today)
  updateTrendChart(transactions);
  
  // 2. Category Breakdown (Doughnut)
  updateCategoryChart(filteredTxs);
  
  // 3. Top Merchants (Bar)
  updateMerchantChart(filteredTxs);
}

function updateTrendChart(transactions) {
  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;
  
  // Get last 6 months
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }
  
  const incomeData = months.map(m => {
    return transactions.filter(tx => !tx.isSplit && tx.type === 'income' && tx.date.startsWith(m))
      .reduce((sum, tx) => sum + tx.amount, 0);
  });
  
  const expenseData = months.map(m => {
    return transactions.filter(tx => !tx.isSplit && tx.type === 'expense' && tx.date.startsWith(m))
      .reduce((sum, tx) => sum + tx.amount, 0);
  });
  
  const monthLabels = months.map(m => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-IN', { month: 'short' });
  });
  
  const successColor = getCssVar('--accent-success') || '#10b981';
  const dangerColor = getCssVar('--accent-danger') || '#ef4444';
  const textColor = getCssVar('--text-secondary') || '#94a3b8';
  const gridColor = getCssVar('--border-subtle') || 'rgba(255, 255, 255, 0.08)';

  if (currentCharts.trend) currentCharts.trend.destroy();
  
  currentCharts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: successColor,
          backgroundColor: successColor + '33',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Expense',
          data: expenseData,
          borderColor: dangerColor,
          backgroundColor: dangerColor + '33',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });
}

function updateCategoryChart(transactions) {
  const ctx = document.getElementById('category-chart');
  if (!ctx) return;
  
  const expenses = transactions.filter(tx => tx.type === 'expense');
  const catSums = {};
  
  for (const tx of expenses) {
    catSums[tx.category] = (catSums[tx.category] || 0) + tx.amount;
  }
  
  const sortedCats = Object.entries(catSums).sort((a, b) => b[1] - a[1]);
  
  const labels = sortedCats.map(c => CATEGORY_MAP[c[0]]?.label || c[0]);
  const data = sortedCats.map(c => c[1]);
  const bgColors = sortedCats.map(c => CATEGORY_MAP[c[0]]?.colorHex || '#94a3b8');
  
  const textColor = getCssVar('--text-secondary') || '#94a3b8';

  if (currentCharts.category) currentCharts.category.destroy();
  
  currentCharts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor } }
      }
    }
  });
}

function updateMerchantChart(transactions) {
  const ctx = document.getElementById('merchant-chart');
  if (!ctx) return;
  
  const expenses = transactions.filter(tx => tx.type === 'expense');
  const merchantSums = {};
  
  for (const tx of expenses) {
    const m = tx.merchant || tx.description || 'Unknown';
    merchantSums[m] = (merchantSums[m] || 0) + tx.amount;
  }
  
  const topMerchants = Object.entries(merchantSums).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  const labels = topMerchants.map(m => m[0]);
  const data = topMerchants.map(m => m[1]);
  
  const primaryColor = getCssVar('--accent-primary') || '#6366f1';
  const textColor = getCssVar('--text-secondary') || '#94a3b8';
  const gridColor = getCssVar('--border-subtle') || 'rgba(255, 255, 255, 0.08)';

  if (currentCharts.merchant) currentCharts.merchant.destroy();
  
  currentCharts.merchant = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spent',
        data,
        backgroundColor: primaryColor,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { display: false }, ticks: { color: textColor } }
      }
    }
  });
}

export function renderAnalytics(container) {
  container.innerHTML = `
    <div style="padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-6);min-height:100%;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 class="page-title" style="font-size:1.5rem;font-weight:700;">Analytics</h1>
          <p class="page-subtitle" style="color:var(--text-secondary);">Visualize your spending habits</p>
        </div>
        <select id="date-range-select" class="select-field" style="width:200px;">
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>
      
      <div class="glass-card" style="height:400px;display:flex;flex-direction:column;">
        <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:var(--space-4);">Income vs Expense Trend</h3>
        <div style="flex:1;position:relative;">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(400px, 1fr));gap:var(--space-6);">
        <div class="glass-card" style="height:350px;display:flex;flex-direction:column;">
          <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:var(--space-4);">Category Breakdown</h3>
          <div style="flex:1;position:relative;">
            <canvas id="category-chart"></canvas>
          </div>
        </div>
        
        <div class="glass-card" style="height:350px;display:flex;flex-direction:column;">
          <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:var(--space-4);">Top Merchants</h3>
          <div style="flex:1;position:relative;">
            <canvas id="merchant-chart"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Need slight delay for DOM insertion before creating charts
  setTimeout(() => {
    updateCharts('this_month');
    
    const select = container.querySelector('#date-range-select');
    select.addEventListener('change', (e) => {
      updateCharts(e.target.value);
    });
  }, 0);
}

export default {
  render(container) {
    renderAnalytics(container);
    
    unsubscribe = store.subscribe('transactions', () => {
      const select = document.getElementById('date-range-select');
      if (select) {
        updateCharts(select.value);
      }
    });
  },
  destroy() {
    if (unsubscribe) unsubscribe();
    Object.values(currentCharts).forEach(chart => {
      if (chart && chart.destroy) chart.destroy();
    });
    currentCharts = {};
  }
};
