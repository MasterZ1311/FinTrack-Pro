import { store } from '../../store.js';
import { jsPDF } from 'jspdf';
import { createIcons, Download, Lock, CheckCircle2, TrendingUp, TrendingDown, DollarSign, Building2, Plus, X } from 'lucide';

// ─── CSS Injection ─────────────────────────────────────────────────────────────

let cssInjected = false;

function injectStyles() {
  if (cssInjected) return;
  cssInjected = true;

  const style = document.createElement('style');
  style.id = 'corp-styles';
  style.textContent = `
    .corp-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      color: #f1f5f9;
      animation: corpFadeIn 0.4s ease-out;
    }

    @keyframes corpFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Lock Screen */
    .corp-lock {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 80vh;
      text-align: center;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }
    .corp-lock-icon {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
      border: 1px solid rgba(99, 102, 241, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      color: #818cf8;
      box-shadow: 0 0 30px rgba(99, 102, 241, 0.2);
    }
    .corp-lock-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #f1f5f9, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .corp-lock-desc {
      font-size: 1.125rem;
      color: #94a3b8;
      max-width: 480px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .corp-lock-btn {
      padding: 14px 28px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-weight: 600;
      font-size: 1rem;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s;
      box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
    }
    .corp-lock-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 25px rgba(99, 102, 241, 0.4);
    }

    /* Dashboard Grid */
    .corp-header {
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .corp-header h1 {
      font-size: 2.25rem;
      font-weight: 800;
      margin: 0 0 8px 0;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .corp-header p {
      color: #94a3b8;
      margin: 0;
      font-size: 1.125rem;
    }
    
    .corp-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 24px;
    }

    .corp-card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 24px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s, border-color 0.3s;
      display: flex;
      flex-direction: column;
    }
    .corp-card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .corp-card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .corp-card-title i {
      color: #818cf8;
    }

    /* P&L Snapshot */
    .corp-span-8 { grid-column: span 8; }
    .corp-span-4 { grid-column: span 4; }
    @media (max-width: 1024px) {
      .corp-span-8, .corp-span-4 { grid-column: span 12; }
    }

    .corp-pl-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .corp-stat {
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .corp-stat-label {
      font-size: 0.875rem;
      color: #94a3b8;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .corp-stat-val {
      font-size: 1.75rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .corp-stat-rev .corp-stat-val { color: #10b981; }
    .corp-stat-exp .corp-stat-val { color: #f43f5e; }
    .corp-stat-net .corp-stat-val { color: #6366f1; }

    /* Tax Tracking */
    .corp-tax-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .corp-tax-row:last-child { margin-bottom: 0; }
    .corp-tax-label { font-size: 0.9375rem; color: #cbd5e1; }
    .corp-tax-val { font-size: 1.125rem; font-weight: 600; }
    .corp-tax-net {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(16, 185, 129, 0.1));
      border: 1px solid rgba(6, 182, 212, 0.2);
    }
    .corp-tax-net .corp-tax-val { color: #22d3ee; font-size: 1.25rem; }

    /* Clients List */
    .corp-clients-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
      flex: 1;
      overflow-y: auto;
    }
    .corp-client-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      transition: background 0.2s;
    }
    .corp-client-item:hover { background: rgba(255, 255, 255, 0.05); }
    .corp-client-info h4 { margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; color: #f1f5f9; }
    .corp-client-info p { margin: 0; font-size: 0.8125rem; color: #94a3b8; }
    
    .corp-btn-primary {
      padding: 12px 20px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-weight: 600;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }
    .corp-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
    }

    /* Modal */
    .corp-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .corp-modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    .corp-modal {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      width: 100%;
      max-width: 500px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      transform: scale(0.95);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .corp-modal-overlay.active .corp-modal {
      transform: scale(1);
    }
    .corp-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .corp-modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #f1f5f9; }
    .corp-modal-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      border-radius: 8px;
      transition: background 0.2s, color 0.2s;
    }
    .corp-modal-close:hover { background: rgba(255, 255, 255, 0.1); color: #f1f5f9; }
    
    .corp-form-group { margin-bottom: 20px; }
    .corp-form-group label { display: block; font-size: 0.875rem; font-weight: 500; color: #cbd5e1; margin-bottom: 8px; }
    .corp-input {
      width: 100%;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 12px 14px;
      color: #f1f5f9;
      font-size: 0.9375rem;
      font-family: inherit;
      transition: border-color 0.2s;
      outline: none;
    }
    .corp-input:focus { border-color: #6366f1; }
  `;
  document.head.appendChild(style);
}

// ─── Format Helpers ────────────────────────────────────────────────────────────

const formatCurrency = (amount, currency = 'INR', locale = 'en-IN') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

// Simple in-memory clients array since we don't have a dedicated store for it.
let mockClients = [
  { id: '1', name: 'Acme Corp', contact: 'contact@acme.com', due: 15000 },
  { id: '2', name: 'Global Tech LLC', contact: 'billing@globaltech.com', due: 0 },
  { id: '3', name: 'Stark Industries', contact: 'tony@stark.com', due: 45000 }
];

// ─── Main Module ───────────────────────────────────────────────────────────────

let containerEl = null;

const render = (container) => {
  containerEl = container;
  injectStyles();
  
  const profile = store.getState('profile');
  
  if (!profile || profile.type !== 'corporate') {
    renderLockScreen();
    return;
  }
  
  renderDashboard();
};

const renderLockScreen = () => {
  containerEl.innerHTML = `
    <div class="corp-container" style="display:flex;align-items:center;justify-content:center;height:100%;">
      <div class="corp-lock">
        <div class="corp-lock-icon">
          <i data-lucide="lock" style="width:36px;height:36px;"></i>
        </div>
        <h2 class="corp-lock-title">Corporate Mode Locked</h2>
        <p class="corp-lock-desc">
          You are currently using an Individual profile. Upgrade to a Corporate Individual profile to unlock advanced features like Invoicing, GST tracking, and P&L statements.
        </p>
        <button class="corp-lock-btn" id="corp-upgrade-btn">
          <i data-lucide="check-circle-2"></i> Update Profile Settings
        </button>
      </div>
    </div>
  `;
  
  createIcons({
    icons: { Lock, CheckCircle2 },
    nameAttr: 'data-lucide',
  });

  const btn = containerEl.querySelector('#corp-upgrade-btn');
  btn.addEventListener('click', () => {
    window.location.hash = '#/settings';
  });
};

const renderDashboard = () => {
  const profile = store.getState('profile');
  const transactions = store.getState('transactions') || [];
  
  // Calculate P&L for current quarter (simplified: using all transactions for demo)
  const incomeTxs = transactions.filter(t => !t.isSplit && t.type === 'income');
  const expenseTxs = transactions.filter(t => !t.isSplit && t.type === 'expense');
  
  const totalRev = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalExp = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRev - totalExp;

  // Calculate GST
  const inputTax = expenseTxs.reduce((sum, t) => sum + (t.gstAmount || 0), 0);
  const outputTax = incomeTxs.reduce((sum, t) => sum + (t.gstAmount || 0), 0);
  const netLiability = outputTax - inputTax;

  containerEl.innerHTML = `
    <div class="corp-container">
      <div class="corp-header">
        <div>
          <h1>Corporate Dashboard</h1>
          <p>${profile.businessName || profile.ownerName || 'Business Overview'}</p>
        </div>
      </div>

      <div class="corp-grid">
        <!-- P&L Snapshot -->
        <div class="corp-card corp-span-8">
          <div class="corp-card-title">
            <i data-lucide="trending-up"></i> P&L Snapshot
          </div>
          <div class="corp-pl-stats">
            <div class="corp-stat corp-stat-rev">
              <span class="corp-stat-label">Business Revenue</span>
              <span class="corp-stat-val">${formatCurrency(totalRev, profile.currency, profile.locale)}</span>
            </div>
            <div class="corp-stat corp-stat-exp">
              <span class="corp-stat-label">Business Expenses</span>
              <span class="corp-stat-val">${formatCurrency(totalExp, profile.currency, profile.locale)}</span>
            </div>
            <div class="corp-stat corp-stat-net">
              <span class="corp-stat-label">Net Profit</span>
              <span class="corp-stat-val">${formatCurrency(netProfit, profile.currency, profile.locale)}</span>
            </div>
          </div>
          <div style="flex:1;background:rgba(0,0,0,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#64748b;min-height:150px;border:1px dashed rgba(255,255,255,0.1);">
            <p>Quarterly Chart (Coming Soon)</p>
          </div>
        </div>

        <!-- Tax Tracking -->
        <div class="corp-card corp-span-4">
          <div class="corp-card-title">
            <i data-lucide="dollar-sign"></i> Tax / GST Tracking
          </div>
          <div style="display:flex;flex-direction:column;flex:1;justify-content:center;">
            <div class="corp-tax-row">
              <span class="corp-tax-label">Total Input Tax (Paid)</span>
              <span class="corp-tax-val" style="color:#f43f5e;">${formatCurrency(inputTax, profile.currency, profile.locale)}</span>
            </div>
            <div class="corp-tax-row">
              <span class="corp-tax-label">Total Output Tax (Collected)</span>
              <span class="corp-tax-val" style="color:#10b981;">${formatCurrency(outputTax, profile.currency, profile.locale)}</span>
            </div>
            <div class="corp-tax-row corp-tax-net" style="margin-top:16px;">
              <span class="corp-tax-label">Net Tax Liability</span>
              <span class="corp-tax-val">${formatCurrency(netLiability, profile.currency, profile.locale)}</span>
            </div>
          </div>
        </div>

        <!-- Clients & Invoicing -->
        <div class="corp-card corp-span-12">
          <div class="corp-card-title">
            <i data-lucide="building-2"></i> Invoicing & Clients
          </div>
          <div style="display:flex;gap:24px;align-items:stretch;">
            <div style="flex:1;">
              <h3 style="margin:0 0 16px 0;font-size:1rem;color:#cbd5e1;">Active Clients</h3>
              <div class="corp-clients-list">
                ${mockClients.map(c => `
                  <div class="corp-client-item">
                    <div class="corp-client-info">
                      <h4>${c.name}</h4>
                      <p>${c.contact}</p>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:0.75rem;color:#64748b;">Outstanding</div>
                      <div style="font-weight:600;color:${c.due > 0 ? '#f43f5e' : '#10b981'};">
                        ${formatCurrency(c.due, profile.currency, profile.locale)}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div style="width:300px;display:flex;flex-direction:column;justify-content:center;background:rgba(15,23,42,0.4);border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.05);text-align:center;">
              <div style="width:64px;height:64px;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2));border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px auto;color:#818cf8;">
                <i data-lucide="plus" style="width:32px;height:32px;"></i>
              </div>
              <h3 style="margin:0 0 8px 0;font-size:1.125rem;">Create Invoice</h3>
              <p style="color:#94a3b8;font-size:0.875rem;margin:0 0 24px 0;">Generate professional PDF invoices for your clients instantly.</p>
              <button class="corp-btn-primary" id="corp-open-invoice-modal">
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoice Modal -->
    <div class="corp-modal-overlay" id="corp-invoice-modal">
      <div class="corp-modal">
        <div class="corp-modal-header">
          <h3>Generate Invoice</h3>
          <button class="corp-modal-close" id="corp-close-invoice-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="corp-invoice-form">
          <div class="corp-form-group">
            <label>Client Name</label>
            <input type="text" id="inv-client" class="corp-input" required placeholder="e.g. Acme Corp">
          </div>
          <div class="corp-form-group">
            <label>Item Description</label>
            <input type="text" id="inv-item" class="corp-input" required placeholder="e.g. Web Development Services">
          </div>
          <div style="display:flex;gap:16px;">
            <div class="corp-form-group" style="flex:1;">
              <label>Amount (${profile.currencySymbol || '$'})</label>
              <input type="number" id="inv-amount" class="corp-input" required min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="corp-form-group" style="flex:1;">
              <label>Tax/GST (%)</label>
              <input type="number" id="inv-tax" class="corp-input" value="18" min="0" max="100">
            </div>
          </div>
          <button type="submit" class="corp-btn-primary" style="margin-top:12px;">
            <i data-lucide="download"></i> Download PDF
          </button>
        </form>
      </div>
    </div>
  `;

  createIcons({
    icons: { TrendingUp, TrendingDown, DollarSign, Building2, Plus, X, Download },
    nameAttr: 'data-lucide',
  });

  setupInvoiceModal(profile);
};

const setupInvoiceModal = (profile) => {
  const modal = containerEl.querySelector('#corp-invoice-modal');
  const openBtn = containerEl.querySelector('#corp-open-invoice-modal');
  const closeBtn = containerEl.querySelector('#corp-close-invoice-modal');
  const form = containerEl.querySelector('#corp-invoice-form');

  openBtn.addEventListener('click', () => modal.classList.add('active'));
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const client = document.getElementById('inv-client').value;
    const item = document.getElementById('inv-item').value;
    const amount = parseFloat(document.getElementById('inv-amount').value);
    const taxRate = parseFloat(document.getElementById('inv-tax').value) || 0;
    
    generatePDFInvoice(profile, client, item, amount, taxRate);
    modal.classList.remove('active');
    form.reset();
  });
};

const generatePDFInvoice = (profile, client, item, amount, taxRate) => {
  const doc = new jsPDF();
  
  const taxAmount = (amount * taxRate) / 100;
  const total = amount + taxAmount;
  const currency = profile.currency || 'INR';

  // Styling properties
  const primaryColor = '#6366f1';
  const textColor = '#1e293b';
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(primaryColor);
  doc.text('INVOICE', 20, 30);
  
  doc.setFontSize(10);
  doc.setTextColor('#64748b');
  const dateStr = new Date().toLocaleDateString();
  const invoiceId = 'INV-' + Math.floor(Math.random() * 100000);
  doc.text(`Date: ${dateStr}`, 150, 25);
  doc.text(`Invoice #: ${invoiceId}`, 150, 32);

  // Business Info
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.businessName || profile.ownerName || 'My Business', 20, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (profile.gstin) {
    doc.text(`GSTIN: ${profile.gstin}`, 20, 56);
  }
  
  // Bill To
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, 75);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(client, 20, 82);

  // Line Items Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(20, 100, 170, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 25, 107);
  doc.text('Amount', 160, 107);
  
  // Line Item
  doc.setFont('helvetica', 'normal');
  doc.text(item, 25, 120);
  doc.text(formatCurrency(amount, currency), 160, 120);
  
  // Line separator
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 130, 190, 130);
  
  // Totals
  doc.text('Subtotal:', 130, 140);
  doc.text(formatCurrency(amount, currency), 160, 140);
  
  doc.text(`Tax (${taxRate}%):`, 130, 150);
  doc.text(formatCurrency(taxAmount, currency), 160, 150);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Due:', 130, 165);
  doc.setTextColor(primaryColor);
  doc.text(formatCurrency(total, currency), 160, 165);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor('#94a3b8');
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', 105, 270, { align: 'center' });

  // Save
  doc.save(`${invoiceId}-${client.replace(/\s+/g, '-')}.pdf`);
};

const destroy = () => {
  if (containerEl) {
    containerEl.innerHTML = '';
  }
};

export default {
  render,
  destroy
};
