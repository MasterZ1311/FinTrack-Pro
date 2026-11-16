import { store } from '../../store.js';
import { add, getAll } from '../../db.js';

let unsubscribe = null;
let chartInstance = null;

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function calculatePortfolio(investments) {
  let totalValue = 0;
  let totalCost = 0;
  
  const allocation = {};

  for (const inv of investments) {
    const value = (inv.quantity || 0) * (inv.currentPrice || 0);
    const cost = (inv.quantity || 0) * (inv.avgBuyPrice || 0);
    
    totalValue += value;
    totalCost += cost;

    if (!allocation[inv.type]) {
      allocation[inv.type] = 0;
    }
    allocation[inv.type] += value;
  }

  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  return { totalValue, totalCost, totalGainLoss, totalGainLossPercent, allocation };
}

function renderChart(container, allocation) {
  const canvas = container.querySelector('#allocation-chart');
  if (!canvas) return;

  if (typeof window.Chart === 'undefined') {
    const ctx = canvas.getContext('2d');
    ctx.font = '14px Inter';
    ctx.fillStyle = 'var(--text-secondary)';
    ctx.fillText('Chart.js is not loaded', 10, 50);
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = Object.keys(allocation).map(k => k.replace('_', ' ').toUpperCase());
  const data = Object.values(allocation);
  
  if (data.length === 0) {
     // No data fallback
     return;
  }

  chartInstance = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          '#6366f1', // accent-primary
          '#06b6d4', // accent-tertiary
          '#10b981', // accent-success
          '#f59e0b', // accent-warning
          '#ef4444'  // accent-danger
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#f1f5f9', font: { family: 'Inter' } }
        }
      }
    }
  });
}

function renderInvestmentCards(investments) {
  if (!investments || investments.length === 0) {
    return `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: var(--space-8);">No investments added yet.</div>`;
  }

  return investments.map(inv => {
    const value = (inv.quantity || 0) * (inv.currentPrice || 0);
    const cost = (inv.quantity || 0) * (inv.avgBuyPrice || 0);
    const gainLoss = value - cost;
    const gainLossPercent = cost > 0 ? (gainLoss / cost) * 100 : 0;
    
    const isPositive = gainLoss >= 0;
    const color = isPositive ? 'var(--accent-success)' : 'var(--accent-danger)';
    const prefix = isPositive ? '+' : '';

    return `
      <div class="glass-card" style="display: flex; flex-direction: column; gap: var(--space-3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${inv.symbol.toUpperCase()}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary); text-transform: capitalize;">${inv.type.replace('_', ' ')}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">${formatCurrency(value)}</div>
            <div style="font-size: 0.875rem; color: ${color}; font-weight: 500;">
              ${prefix}${formatCurrency(gainLoss)} (${prefix}${gainLossPercent.toFixed(2)}%)
            </div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: var(--space-3); margin-top: var(--space-1);">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Quantity</span>
            <span style="font-size: 0.875rem; color: var(--text-secondary);">${inv.quantity}</span>
          </div>
          <div style="display: flex; flex-direction: column; text-align: right;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Avg Buy / Current</span>
            <span style="font-size: 0.875rem; color: var(--text-secondary);">${formatCurrency(inv.avgBuyPrice)} / ${formatCurrency(inv.currentPrice)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getModalHTML() {
  return `
    <div id="investment-modal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width: 400px;">
        <h3 style="margin-bottom: var(--space-4); font-size: 1.25rem; font-weight: 600;">Add Investment</h3>
        <form id="investment-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
          
          <div>
            <label class="stat-label" style="display:block; margin-bottom:var(--space-1);">Symbol / Name</label>
            <input type="text" id="inv-symbol" class="input-field" placeholder="e.g. AAPL, BTC" required />
          </div>
          
          <div>
            <label class="stat-label" style="display:block; margin-bottom:var(--space-1);">Asset Type</label>
            <select id="inv-type" class="select-field" required>
              <option value="stock">Stock</option>
              <option value="crypto">Crypto</option>
              <option value="mutual_fund">Mutual Fund</option>
              <option value="etf">ETF</option>
              <option value="real_estate">Real Estate</option>
            </select>
          </div>

          <div style="display: flex; gap: var(--space-3);">
            <div style="flex: 1;">
              <label class="stat-label" style="display:block; margin-bottom:var(--space-1);">Quantity</label>
              <input type="number" id="inv-qty" class="input-field" step="any" placeholder="0.00" required />
            </div>
            <div style="flex: 1;">
              <label class="stat-label" style="display:block; margin-bottom:var(--space-1);">Avg Buy Price</label>
              <input type="number" id="inv-buy" class="input-field" step="any" placeholder="0.00" required />
            </div>
          </div>
          
          <div>
            <label class="stat-label" style="display:block; margin-bottom:var(--space-1);">Current Price</label>
            <input type="number" id="inv-current" class="input-field" step="any" placeholder="0.00" required />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-4);">
            <button type="button" id="close-modal-btn" class="btn btn-ghost">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Investment</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderInvestments(container) {
  const investments = store.state.investments || [];
  const portfolio = calculatePortfolio(investments);
  
  const isPositive = portfolio.totalGainLoss >= 0;
  const color = isPositive ? 'var(--accent-success)' : 'var(--accent-danger)';
  const prefix = isPositive ? '+' : '';

  container.innerHTML = `
    <div style="padding:var(--space-4); max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-6); position: relative; min-height: 100%;">
      
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="font-size:1.5rem; font-weight:600; color:var(--text-primary);">Investment Portfolio</h2>
        <button id="add-investment-btn" class="btn btn-primary">Add Investment</button>
      </div>

      <!-- Overview Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-4);">
        <div class="glass-card stat-card">
          <span class="stat-label">Total Value</span>
          <span class="stat-value">${formatCurrency(portfolio.totalValue)}</span>
        </div>
        <div class="glass-card stat-card">
          <span class="stat-label">Total Cost</span>
          <span class="stat-value">${formatCurrency(portfolio.totalCost)}</span>
        </div>
        <div class="glass-card stat-card">
          <span class="stat-label">Total Gain / Loss</span>
          <span class="stat-value" style="color: ${color};">
            ${prefix}${formatCurrency(portfolio.totalGainLoss)}
          </span>
          <span style="font-size: 0.875rem; color: ${color}; font-weight: 500;">
            ${prefix}${portfolio.totalGainLossPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <!-- Chart and Asset Allocation -->
      <div class="glass-card" style="display: flex; flex-direction: column; gap: var(--space-4); min-height: 300px;">
        <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">Asset Allocation</h3>
        <div style="position: relative; height: 250px; width: 100%; display: flex; justify-content: center;">
          ${Object.keys(portfolio.allocation).length > 0 
            ? '<canvas id="allocation-chart"></canvas>' 
            : '<div style="display:flex;align-items:center;color:var(--text-secondary);">Add investments to see allocation</div>'}
        </div>
      </div>

      <!-- Grid of Assets -->
      <div>
        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-4); color: var(--text-primary);">Your Assets</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4);">
          ${renderInvestmentCards(investments)}
        </div>
      </div>

      ${getModalHTML()}
    </div>
  `;

  if (Object.keys(portfolio.allocation).length > 0) {
    setTimeout(() => renderChart(container, portfolio.allocation), 0);
  }

  // Setup Modal Interactions
  const modal = container.querySelector('#investment-modal');
  const addBtn = container.querySelector('#add-investment-btn');
  const closeBtn = container.querySelector('#close-modal-btn');
  const form = container.querySelector('#investment-form');

  addBtn.addEventListener('click', () => {
    form.reset();
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const symbol = document.getElementById('inv-symbol').value.trim();
    const type = document.getElementById('inv-type').value;
    const quantity = parseFloat(document.getElementById('inv-qty').value);
    const avgBuyPrice = parseFloat(document.getElementById('inv-buy').value);
    const currentPrice = parseFloat(document.getElementById('inv-current').value);

    if (!symbol || isNaN(quantity) || isNaN(avgBuyPrice) || isNaN(currentPrice)) {
      store.notify({ type: 'error', message: 'Please fill all fields correctly.' });
      return;
    }

    const newInvestment = {
      id: crypto.randomUUID(),
      symbol,
      type,
      quantity,
      avgBuyPrice,
      currentPrice,
      lastUpdated: new Date().toISOString()
    };

    try {
      await add('investments', newInvestment);
      const allInvestments = await getAll('investments');
      store.setState('investments', allInvestments);
      store.notify({ type: 'success', message: 'Investment added successfully!' });
      modal.style.display = 'none';
    } catch (err) {
      console.error(err);
      store.notify({ type: 'error', message: 'Failed to add investment.' });
    }
  });
}

export default {
  render(container) {
    renderInvestments(container);
    
    unsubscribe = store.subscribeAll((key) => {
      if (['investments'].includes(key)) {
        renderInvestments(container);
      }
    });
  },
  destroy() {
    if (unsubscribe) unsubscribe();
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }
};
