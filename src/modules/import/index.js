/**
 * FinTrack Pro — Bank Statement Import Module
 * Full import workflow: file drop → bank detection → preview → mapping → review → commit.
 */

import { parseStatement, allBankProfiles, getProfileById } from '../../parsers/index.js';
import { add as dbAdd, getAll } from '../../db.js';
import { store } from '../../store.js';
import { navigate } from '../../router.js';
import { ALL_CATEGORIES } from '../transactions/categories.js';
import { escapeHtml } from '../../utils/security.js';

// ─── State ──────────────────────────────────────────────────────────────────

/** @type {{ step: number, file: File|null, parseResult: object|null, selectedBank: string|null, transactions: object[], approved: Set<string> }} */
let importState = {
  step: 0,          // 0=drop, 1=detecting, 2=preview, 3=column-map, 4=summary, 5=review, 6=done
  file: null,
  parseResult: null,
  selectedBank: null,
  transactions: [],
  approved: new Set(),
  reviewPage: 0,
  reviewPageSize: 25,
};

/** @type {HTMLElement|null} */
let container = null;

// ─── Render Entry ───────────────────────────────────────────────────────────

export function render(el) {
  container = el;
  resetState();
  renderDropZone();
}

export function destroy() {
  container = null;
  resetState();
}

function resetState() {
  importState = {
    step: 0,
    file: null,
    parseResult: null,
    selectedBank: null,
    transactions: [],
    approved: new Set(),
    reviewPage: 0,
    reviewPageSize: 25,
  };
}

// ─── Step 0: Drop Zone ──────────────────────────────────────────────────────

function renderDropZone() {
  if (!container) return;

  container.innerHTML = `
    <div class="import-module">
      <div class="import-header">
        <h1 class="import-title">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import Bank Statement
        </h1>
        <p class="import-subtitle">
          Drop your bank statement file below or browse to select. Supports CSV, PDF, and OFX/QFX formats from 20+ banks.
        </p>
      </div>

      <div class="drop-zone" id="import-drop-zone">
        <div class="drop-zone-inner">
          <div class="drop-zone-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <p class="drop-zone-text">Drag & drop your statement here</p>
          <p class="drop-zone-hint">or</p>
          <label class="btn btn-primary drop-zone-browse" for="import-file-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Browse Files
          </label>
          <input type="file" id="import-file-input" accept=".csv,.pdf,.ofx,.qfx" hidden />
          <p class="drop-zone-formats">
            <span class="format-badge">CSV</span>
            <span class="format-badge">PDF</span>
            <span class="format-badge">OFX</span>
            <span class="format-badge">QFX</span>
          </p>
        </div>
      </div>

      <div class="supported-banks">
        <h3 class="banks-title">Supported Banks</h3>
        <div class="banks-grid">
          <div class="banks-column">
            <h4 class="banks-region">
              <span class="region-flag">🇮🇳</span> India
            </h4>
            <ul class="banks-list">
              ${allBankProfiles.filter(b => b.country === 'IN').map(b => `
                <li class="bank-item" data-bank="${b.id}">
                  <span class="bank-dot" style="background:${getBankColor(b.id)}"></span>
                  ${b.name}
                </li>
              `).join('')}
            </ul>
          </div>
          <div class="banks-column">
            <h4 class="banks-region">
              <span class="region-flag">🌍</span> International
            </h4>
            <ul class="banks-list">
              ${allBankProfiles.filter(b => b.country !== 'IN').map(b => `
                <li class="bank-item" data-bank="${b.id}">
                  <span class="bank-dot" style="background:${getBankColor(b.id)}"></span>
                  ${b.name}
                  <span class="bank-country">${getCountryFlag(b.country)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const dropZone = document.getElementById('import-drop-zone');
  const fileInput = document.getElementById('import-file-input');

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (files?.length > 0) handleFile(files[0]);
  });

  // File input
  fileInput.addEventListener('change', (e) => {
    if (e.target.files?.length > 0) handleFile(e.target.files[0]);
  });

  // Click on drop zone (but not on the browse button)
  dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('.drop-zone-browse')) {
      fileInput.click();
    }
  });

  injectStyles();
}

// ─── Step 1: Detecting ──────────────────────────────────────────────────────

async function handleFile(file) {
  importState.file = file;
  importState.step = 1;

  if (!container) return;

  container.innerHTML = `
    <div class="import-module">
      <div class="detecting-screen">
        <div class="detecting-animation">
          <div class="detecting-rings">
            <div class="ring ring-1"></div>
            <div class="ring ring-2"></div>
            <div class="ring ring-3"></div>
          </div>
          <div class="detecting-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
        <h2 class="detecting-title">Analyzing Statement</h2>
        <p class="detecting-subtitle">${file.name}</p>
        <div class="detecting-steps">
          <div class="detect-step active" id="ds-format">
            <span class="detect-check">◉</span> Detecting format...
          </div>
          <div class="detect-step" id="ds-bank">
            <span class="detect-check">○</span> Identifying bank...
          </div>
          <div class="detect-step" id="ds-parse">
            <span class="detect-check">○</span> Parsing transactions...
          </div>
        </div>
      </div>
    </div>
  `;

  injectStyles();

  // Small delay for visual feedback
  await sleep(600);

  // Update step indicators as we progress
  const dsFormat = document.getElementById('ds-format');
  const dsBank = document.getElementById('ds-bank');
  const dsParse = document.getElementById('ds-parse');

  if (dsFormat) {
    dsFormat.innerHTML = '<span class="detect-check done">✓</span> Format detected';
    dsFormat.classList.add('done');
  }
  if (dsBank) {
    dsBank.classList.add('active');
    dsBank.innerHTML = '<span class="detect-check">◉</span> Identifying bank...';
  }

  await sleep(400);

  try {
    const result = await parseStatement(file, {
      bankProfileId: importState.selectedBank,
    });

    if (dsBank) {
      const bankName = result.bankProfile?.name || 'Unknown Bank';
      dsBank.innerHTML = `<span class="detect-check done">✓</span> Bank: ${escapeHtml(bankName)}`;
      dsBank.classList.add('done');
    }
    if (dsParse) {
      dsParse.classList.add('active');
      dsParse.innerHTML = '<span class="detect-check">◉</span> Parsing transactions...';
    }

    await sleep(400);

    if (dsParse) {
      dsParse.innerHTML = `<span class="detect-check done">✓</span> Found ${result.transactions.length} transactions`;
      dsParse.classList.add('done');
    }

    importState.parseResult = result;
    importState.transactions = result.transactions;

    // Pre-approve all transactions
    importState.approved = new Set(result.transactions.map((_, i) => String(i)));

    await sleep(600);

    if (result.transactions.length === 0) {
      renderError(result.errors.join('. ') || 'No transactions found in the file.');
    } else {
      renderPreview();
    }
  } catch (err) {
    console.error('[Import] Parse failed:', err);
    renderError(`Failed to parse file: ${err.message}`);
  }
}

// ─── Step 2: Preview ────────────────────────────────────────────────────────

function renderPreview() {
  importState.step = 2;
  if (!container) return;

  const { parseResult, transactions } = importState;
  const profile = parseResult.bankProfile;
  const preview = transactions.slice(0, 5);

  container.innerHTML = `
    <div class="import-module">
      <div class="import-header">
        <h1 class="import-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Preview Parsed Transactions
        </h1>
      </div>

      <div class="preview-bank-info glass-card">
        <div class="bank-detected">
          <div class="bank-detected-icon" style="background:${profile ? getBankColor(profile.id) : 'var(--accent-primary)'}">
            ${profile ? profile.name.charAt(0) : '?'}
          </div>
          <div class="bank-detected-details">
            <h3>${profile ? escapeHtml(profile.name) : 'Unknown Bank'}</h3>
            <p>${profile ? `${escapeHtml(profile.country)} • ${escapeHtml(profile.currency)}` : 'Auto-detection uncertain'}</p>
          </div>
          ${profile ? `<span class="badge badge-success">Auto-detected</span>` : `<span class="badge badge-warning">Manual selection needed</span>`}
        </div>

        ${!profile ? `
          <div class="bank-select-wrapper">
            <label>Select your bank:</label>
            <select class="select-field" id="import-bank-select">
              <option value="">-- Select Bank --</option>
              <optgroup label="🇮🇳 Indian Banks">
                ${allBankProfiles.filter(b => b.country === 'IN').map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
              </optgroup>
              <optgroup label="🌍 International Banks">
                ${allBankProfiles.filter(b => b.country !== 'IN').map(b => `<option value="${b.id}">${b.name} (${b.country})</option>`).join('')}
              </optgroup>
            </select>
          </div>
        ` : ''}
      </div>

      <div class="preview-table-wrapper glass-card">
        <h3>First ${preview.length} Transactions</h3>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th class="text-right">Debit</th>
                <th class="text-right">Credit</th>
                <th class="text-right">Balance</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${preview.map(tx => `
                <tr>
                  <td><code>${tx.date}</code></td>
                  <td class="desc-cell">${escapeHtml(tx.description)}</td>
                  <td class="text-right ${tx.debit ? 'amount-debit' : ''}">${tx.debit ? formatAmount(tx.debit) : '—'}</td>
                  <td class="text-right ${tx.credit ? 'amount-credit' : ''}">${tx.credit ? formatAmount(tx.credit) : '—'}</td>
                  <td class="text-right">${tx.balance !== null ? formatAmount(tx.balance) : '—'}</td>
                  <td><div class="confidence-bar"><div class="confidence-fill" style="width:${(tx.confidence * 100)}%;background:${getConfidenceColor(tx.confidence)}"></div></div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="preview-note">Showing ${preview.length} of ${transactions.length} transactions</p>
      </div>

      ${parseResult.errors.length > 0 ? `
        <div class="import-warnings glass-card">
          <h4>⚠️ Warnings</h4>
          <ul>${parseResult.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
        </div>
      ` : ''}

      <div class="preview-actions">
        <button class="btn btn-secondary" id="import-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Start Over
        </button>
        <button class="btn btn-primary" id="import-continue-btn">
          Continue to Summary
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  `;

  injectStyles();

  // Event listeners
  document.getElementById('import-back-btn')?.addEventListener('click', () => {
    resetState();
    renderDropZone();
  });

  document.getElementById('import-continue-btn')?.addEventListener('click', () => {
    renderSummary();
  });

  const bankSelect = document.getElementById('import-bank-select');
  if (bankSelect) {
    bankSelect.addEventListener('change', async (e) => {
      if (e.target.value) {
        importState.selectedBank = e.target.value;
        // Re-parse with selected bank
        await handleFile(importState.file);
      }
    });
  }
}

// ─── Step 4: Summary ────────────────────────────────────────────────────────

function renderSummary() {
  importState.step = 4;
  if (!container) return;

  const { parseResult, transactions } = importState;
  const summary = parseResult.summary;
  const profile = parseResult.bankProfile;
  const currency = profile?.currency || '';
  const symbol = getCurrencySymbol(currency);

  container.innerHTML = `
    <div class="import-module">
      <div class="import-header">
        <h1 class="import-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          Import Summary
        </h1>
      </div>

      <div class="summary-stats-grid">
        <div class="glass-card summary-stat">
          <div class="stat-icon" style="background:rgba(99,102,241,0.15);color:var(--accent-primary)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
          </div>
          <div class="stat-value">${summary.totalTransactions}</div>
          <div class="stat-label">Transactions Found</div>
        </div>

        <div class="glass-card summary-stat">
          <div class="stat-icon" style="background:rgba(245,158,11,0.15);color:var(--accent-warning)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </div>
          <div class="stat-value">${summary.duplicatesSkipped}</div>
          <div class="stat-label">Duplicates Skipped</div>
        </div>

        <div class="glass-card summary-stat">
          <div class="stat-icon" style="background:rgba(239,68,68,0.15);color:var(--accent-danger)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          </div>
          <div class="stat-value">${symbol}${formatAmount(summary.totalDebit)}</div>
          <div class="stat-label">Total Debits</div>
        </div>

        <div class="glass-card summary-stat">
          <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:var(--accent-success)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/></svg>
          </div>
          <div class="stat-value">${symbol}${formatAmount(summary.totalCredit)}</div>
          <div class="stat-label">Total Credits</div>
        </div>
      </div>

      <div class="glass-card summary-meta">
        <div class="meta-row">
          <span class="meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Date Range
          </span>
          <span class="meta-value">${summary.dateRange.from || 'N/A'} → ${summary.dateRange.to || 'N/A'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            File
          </span>
          <span class="meta-value">${importState.file?.name || 'Unknown'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Bank
          </span>
          <span class="meta-value">${profile?.name || 'Auto-detected'} ${profile?.currency ? `(${profile.currency})` : ''}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Net Flow
          </span>
          <span class="meta-value ${summary.netAmount >= 0 ? 'amount-credit' : 'amount-debit'}">${summary.netAmount >= 0 ? '+' : ''}${symbol}${formatAmount(Math.abs(summary.netAmount))}</span>
        </div>
      </div>

      <div class="preview-actions">
        <button class="btn btn-secondary" id="summary-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Preview
        </button>
        <button class="btn btn-primary" id="summary-review-btn">
          Review Transactions
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  `;

  injectStyles();

  document.getElementById('summary-back-btn')?.addEventListener('click', renderPreview);
  document.getElementById('summary-review-btn')?.addEventListener('click', renderReview);
}

// ─── Step 5: Review Queue ───────────────────────────────────────────────────

function renderReview() {
  importState.step = 5;
  if (!container) return;

  const { transactions, approved, reviewPage, reviewPageSize } = importState;
  const profile = importState.parseResult?.bankProfile;
  const symbol = getCurrencySymbol(profile?.currency || '');
  const totalPages = Math.ceil(transactions.length / reviewPageSize);
  const start = reviewPage * reviewPageSize;
  const end = Math.min(start + reviewPageSize, transactions.length);
  const pageTransactions = transactions.slice(start, end);
  const allApproved = approved.size === transactions.length;

  container.innerHTML = `
    <div class="import-module">
      <div class="import-header">
        <div class="review-header-row">
          <h1 class="import-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Review Transactions
          </h1>
          <div class="review-bulk-actions">
            <button class="btn btn-secondary btn-sm" id="review-toggle-all">
              ${allApproved ? 'Deselect All' : 'Select All'}
            </button>
            <span class="review-count">${approved.size} of ${transactions.length} selected</span>
          </div>
        </div>
      </div>

      <div class="review-table-wrapper glass-card">
        <div class="table-container">
          <table class="table review-table">
            <thead>
              <tr>
                <th style="width:40px">
                  <input type="checkbox" id="review-check-all" ${allApproved ? 'checked' : ''} />
                </th>
                <th>Date</th>
                <th>Description</th>
                <th class="text-right">Debit</th>
                <th class="text-right">Credit</th>
                <th>AI Category Suggestion</th>
              </tr>
            </thead>
            <tbody>
              ${pageTransactions.map((tx, localIdx) => {
                const globalIdx = start + localIdx;
                const isApproved = approved.has(String(globalIdx));
                return `
                  <tr class="${isApproved ? '' : 'row-deselected'}" data-idx="${globalIdx}">
                    <td>
                      <input type="checkbox" class="review-checkbox" data-idx="${globalIdx}" ${isApproved ? 'checked' : ''} />
                    </td>
                    <td><code>${tx.date}</code></td>
                    <td class="desc-cell">${escapeHtml(tx.description)}</td>
                    <td class="text-right ${tx.debit ? 'amount-debit' : ''}">
                      ${tx.debit ? symbol + formatAmount(tx.debit) : '—'}
                    </td>
                    <td class="text-right ${tx.credit ? 'amount-credit' : ''}">
                      ${tx.credit ? symbol + formatAmount(tx.credit) : '—'}
                    </td>
                    <td>
                      <select class="category-select select-field" data-idx="${globalIdx}" style="width: 140px; font-size: 0.85rem; padding: 4px;">
                        <option value="Uncategorized">Select...</option>
                        <optgroup label="Expense">
                          ${ALL_CATEGORIES.filter(c => c.type === 'expense').map(c => `
                            <option value="${c.id}" ${tx.category === c.id || tx.category === c.label ? 'selected' : ''}>${c.icon} ${c.label}</option>
                          `).join('')}
                        </optgroup>
                        <optgroup label="Income">
                          ${ALL_CATEGORIES.filter(c => c.type === 'income').map(c => `
                            <option value="${c.id}" ${tx.category === c.id || tx.category === c.label ? 'selected' : ''}>${c.icon} ${c.label}</option>
                          `).join('')}
                        </optgroup>
                      </select>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${totalPages > 1 ? `
          <div class="review-pagination">
            <button class="btn btn-ghost btn-sm" id="review-prev" ${reviewPage === 0 ? 'disabled' : ''}>
              ← Prev
            </button>
            <span class="pagination-info">Page ${reviewPage + 1} of ${totalPages}</span>
            <button class="btn btn-ghost btn-sm" id="review-next" ${reviewPage >= totalPages - 1 ? 'disabled' : ''}>
              Next →
            </button>
          </div>
        ` : ''}
      </div>

      <div class="preview-actions">
        <button class="btn btn-secondary" id="review-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Summary
        </button>
        <button class="btn btn-primary btn-lg" id="review-import-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import ${approved.size} Transaction${approved.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  `;

  injectStyles();

  // Event listeners
  document.getElementById('review-back-btn')?.addEventListener('click', renderSummary);

  document.getElementById('review-import-btn')?.addEventListener('click', commitImport);

  document.getElementById('review-toggle-all')?.addEventListener('click', () => {
    if (approved.size === transactions.length) {
      importState.approved = new Set();
    } else {
      importState.approved = new Set(transactions.map((_, i) => String(i)));
    }
    renderReview();
  });

  document.getElementById('review-check-all')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      importState.approved = new Set(transactions.map((_, i) => String(i)));
    } else {
      importState.approved = new Set();
    }
    renderReview();
  });

  // Individual checkboxes
  container.querySelectorAll('.review-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const idx = e.target.dataset.idx;
      if (e.target.checked) {
        importState.approved.add(idx);
      } else {
        importState.approved.delete(idx);
      }
      // Update the import button count
      const importBtn = document.getElementById('review-import-btn');
      if (importBtn) {
        importBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import ${importState.approved.size} Transaction${importState.approved.size !== 1 ? 's' : ''}
        `;
      }
      // Update row styling
      const row = e.target.closest('tr');
      if (row) row.classList.toggle('row-deselected', !e.target.checked);

      // Update count
      const countEl = container.querySelector('.review-count');
      if (countEl) countEl.textContent = `${importState.approved.size} of ${transactions.length} selected`;
    });
  });

  // Category select change
  container.querySelectorAll('.category-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      importState.transactions[idx].category = e.target.value;
    });
  });

  // Pagination
  document.getElementById('review-prev')?.addEventListener('click', () => {
    if (importState.reviewPage > 0) {
      importState.reviewPage--;
      renderReview();
    }
  });
  document.getElementById('review-next')?.addEventListener('click', () => {
    if (importState.reviewPage < totalPages - 1) {
      importState.reviewPage++;
      renderReview();
    }
  });
}

// ─── Step 6: Commit Import ──────────────────────────────────────────────────

async function commitImport() {
  const { transactions, approved } = importState;
  const profile = importState.parseResult?.bankProfile;

  const toImport = transactions.filter((_, i) => approved.has(String(i)));
  if (toImport.length === 0) {
    store.notify({ type: 'warning', message: 'No transactions selected for import.' });
    return;
  }

  // Show importing state
  if (container) {
    container.innerHTML = `
      <div class="import-module">
        <div class="detecting-screen">
          <div class="detecting-animation">
            <div class="detecting-rings">
              <div class="ring ring-1"></div>
              <div class="ring ring-2"></div>
              <div class="ring ring-3"></div>
            </div>
            <div class="detecting-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
          </div>
          <h2 class="detecting-title">Importing Transactions</h2>
          <p class="detecting-subtitle">Adding ${toImport.length} transactions to your account...</p>
          <div class="import-progress">
            <div class="import-progress-bar" id="import-progress-fill" style="width:0%"></div>
          </div>
        </div>
      </div>
    `;
    injectStyles();
  }

  // Get existing accounts for association
  const accounts = store.getState('accounts') || [];
  const defaultAccountId = accounts.length > 0 ? accounts[0].id : null;

  let imported = 0;
  const progressFill = document.getElementById('import-progress-fill');

  try {
    for (const tx of toImport) {
      const record = {
        id: crypto.randomUUID(),
        date: tx.date,
        description: tx.description,
        amount: tx.debit ? tx.debit : (tx.credit || 0),
        type: tx.debit ? 'expense' : 'income',
        category: tx.category || 'Uncategorized',
        accountId: defaultAccountId,
        bankRef: tx.hash,
        hash: tx.hash,
        source: 'import',
        importedAt: new Date().toISOString(),
        bankName: profile?.name || 'Unknown',
        rawRow: tx.rawRow,
        confidence: tx.confidence,
      };

      await dbAdd('transactions', record);
      imported++;

      // Update progress
      if (progressFill) {
        const pct = Math.round((imported / toImport.length) * 100);
        progressFill.style.width = `${pct}%`;
      }
    }

    // Refresh store
    const allTx = await getAll('transactions');
    store.setState('transactions', allTx);

    // Success!
    store.notify({
      type: 'success',
      message: `✓ ${imported} transaction${imported !== 1 ? 's' : ''} imported successfully`,
      duration: 6000,
    });

    renderSuccess(imported);

  } catch (err) {
    console.error('[Import] Commit failed:', err);
    store.notify({ type: 'error', message: `Import failed: ${err.message}` });
    renderError(`Import failed after ${imported} transactions: ${err.message}`);
  }
}

// ─── Success Screen ─────────────────────────────────────────────────────────

function renderSuccess(count) {
  importState.step = 6;
  if (!container) return;

  container.innerHTML = `
    <div class="import-module">
      <div class="success-screen">
        <div class="success-icon-wrapper">
          <svg class="success-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 class="success-title">Import Complete!</h2>
        <p class="success-subtitle">${count} transaction${count !== 1 ? 's' : ''} have been added to your account.</p>

        <div class="success-actions">
          <button class="btn btn-primary" id="success-view-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            View Transactions
          </button>
          <button class="btn btn-secondary" id="success-import-more-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Another
          </button>
        </div>
      </div>
    </div>
  `;

  injectStyles();

  document.getElementById('success-view-btn')?.addEventListener('click', () => {
    navigate('#/transactions');
  });

  document.getElementById('success-import-more-btn')?.addEventListener('click', () => {
    resetState();
    renderDropZone();
  });
}

// ─── Error Screen ───────────────────────────────────────────────────────────

function renderError(message) {
  if (!container) return;

  container.innerHTML = `
    <div class="import-module">
      <div class="error-screen">
        <div class="error-icon-wrapper">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h2 class="error-title">Import Failed</h2>
        <p class="error-message">${escapeHtml(message)}</p>
        <button class="btn btn-primary" id="error-retry-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Try Again
        </button>
      </div>
    </div>
  `;

  injectStyles();

  document.getElementById('error-retry-btn')?.addEventListener('click', () => {
    resetState();
    renderDropZone();
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatAmount(num) {
  if (num === null || num === undefined) return '—';
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrencySymbol(code) {
  const symbols = { INR: '₹', USD: '$', GBP: '£', EUR: '€', AUD: 'A$', SGD: 'S$' };
  return symbols[code] || '';
}

function getCountryFlag(code) {
  const flags = { IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', AU: '🇦🇺', SG: '🇸🇬' };
  return flags[code] || '🌍';
}

function getBankColor(id) {
  const colors = {
    sbi: '#1a73e8', hdfc: '#004c8f', icici: '#f58220', axis: '#97144d',
    kotak: '#ed1c24', pnb: '#1b3a6b', bob: '#f15a22', canara: '#ffc107',
    idfc: '#9c1d26', federal: '#003087',
    chase: '#117aca', bofa: '#dc1431', 'wells-fargo': '#d71e28',
    hsbc: '#db0011', barclays: '#00aeef', deutsche: '#0018a8',
    'bnp-paribas': '#1b9e4b', santander: '#ec0000', anz: '#007dba', dbs: '#e21c23',
  };
  return colors[id] || 'var(--accent-primary)';
}

function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return 'var(--accent-success)';
  if (confidence >= 0.5) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

// ─── Styles ─────────────────────────────────────────────────────────────────

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'import-module-styles';
  style.textContent = `
    /* ── Import Module ─────────────────────────────────────── */
    .import-module {
      max-width: 960px;
      margin: 0 auto;
      animation: fadeInUp 0.5s ease;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .import-header {
      margin-bottom: var(--space-6);
    }

    .import-title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }

    .import-subtitle {
      color: var(--text-secondary);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    /* ── Drop Zone ─────────────────────────────────────────── */
    .drop-zone {
      border: 2px dashed var(--border-subtle);
      border-radius: var(--radius-xl);
      padding: var(--space-12);
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: var(--bg-surface);
      position: relative;
      overflow: hidden;
    }

    .drop-zone::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(99,102,241,0.05) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .drop-zone:hover,
    .drop-zone.drag-over {
      border-color: var(--accent-primary);
      background: rgba(99, 102, 241, 0.04);
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.1);
    }

    .drop-zone:hover::before,
    .drop-zone.drag-over::before {
      opacity: 1;
    }

    .drop-zone.drag-over {
      transform: scale(1.01);
    }

    .drop-zone-inner {
      position: relative;
      z-index: 1;
    }

    .drop-zone-icon {
      color: var(--text-muted);
      margin-bottom: var(--space-4);
      transition: color 0.3s ease, transform 0.3s ease;
    }

    .drop-zone:hover .drop-zone-icon {
      color: var(--accent-primary);
      transform: translateY(-4px);
    }

    .drop-zone-text {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }

    .drop-zone-hint {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-bottom: var(--space-4);
    }

    .drop-zone-browse {
      padding: var(--space-3) var(--space-6) !important;
      font-size: 0.95rem;
      cursor: pointer;
    }

    .drop-zone-formats {
      margin-top: var(--space-6);
      display: flex;
      justify-content: center;
      gap: var(--space-2);
    }

    .format-badge {
      display: inline-block;
      padding: var(--space-1) var(--space-3);
      background: rgba(99, 102, 241, 0.1);
      color: var(--accent-primary);
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    /* ── Supported Banks ───────────────────────────────────── */
    .supported-banks {
      margin-top: var(--space-8);
    }

    .banks-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: var(--space-4);
    }

    .banks-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-6);
    }

    @media (max-width: 640px) {
      .banks-grid { grid-template-columns: 1fr; }
    }

    .banks-region {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--space-3);
    }

    .banks-list {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .bank-item {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      color: var(--text-secondary);
      transition: all 0.2s ease;
    }

    .bank-item:hover {
      background: var(--bg-surface-hover);
      color: var(--text-primary);
    }

    .bank-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .bank-country {
      font-size: 0.7rem;
    }

    /* ── Detecting Screen ──────────────────────────────────── */
    .detecting-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12) 0;
      text-align: center;
    }

    .detecting-animation {
      position: relative;
      width: 120px;
      height: 120px;
      margin-bottom: var(--space-8);
    }

    .detecting-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-primary);
    }

    .detecting-rings {
      position: absolute;
      inset: 0;
    }

    .ring {
      position: absolute;
      border-radius: 50%;
      border: 2px solid transparent;
    }

    .ring-1 {
      inset: 0;
      border-top-color: var(--accent-primary);
      animation: spin 1.5s linear infinite;
    }

    .ring-2 {
      inset: 10px;
      border-right-color: var(--accent-secondary);
      animation: spin 2s linear infinite reverse;
    }

    .ring-3 {
      inset: 20px;
      border-bottom-color: var(--accent-tertiary);
      animation: spin 2.5s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .detecting-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }

    .detecting-subtitle {
      color: var(--text-secondary);
      font-size: 0.95rem;
      margin-bottom: var(--space-6);
    }

    .detecting-steps {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      text-align: left;
    }

    .detect-step {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--text-muted);
      font-size: 0.9rem;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      transition: all 0.3s ease;
    }

    .detect-step.active {
      color: var(--text-primary);
      background: var(--bg-surface);
    }

    .detect-step.done {
      color: var(--accent-success);
    }

    .detect-check {
      font-size: 1rem;
      width: 20px;
      text-align: center;
    }

    .detect-check.done {
      color: var(--accent-success);
    }

    /* ── Preview ───────────────────────────────────────────── */
    .preview-bank-info {
      margin-bottom: var(--space-6);
    }

    .bank-detected {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .bank-detected-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
    }

    .bank-detected-details h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .bank-detected-details p {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .bank-select-wrapper {
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    .bank-select-wrapper label {
      display: block;
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: var(--space-2);
    }

    .preview-table-wrapper {
      margin-bottom: var(--space-4);
    }

    .preview-table-wrapper h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: var(--space-4);
    }

    .desc-cell {
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .text-right { text-align: right; }

    .amount-debit { color: var(--accent-danger); }
    .amount-credit { color: var(--accent-success); }

    .confidence-bar {
      width: 60px;
      height: 6px;
      background: var(--bg-surface-hover);
      border-radius: 3px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
    }

    .preview-note {
      padding: var(--space-3) var(--space-4);
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: center;
    }

    .import-warnings {
      margin-bottom: var(--space-4);
      border-left: 3px solid var(--accent-warning);
    }

    .import-warnings h4 {
      font-size: 0.9rem;
      margin-bottom: var(--space-2);
    }

    .import-warnings ul {
      padding-left: var(--space-5);
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .preview-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--space-6);
    }

    /* ── Summary ───────────────────────────────────────────── */
    .summary-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    @media (max-width: 768px) {
      .summary-stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .summary-stat {
      text-align: center;
      padding: var(--space-6);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto var(--space-3);
    }

    .summary-meta {
      margin-bottom: var(--space-6);
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) 0;
      border-bottom: 1px solid var(--border-subtle);
    }

    .meta-row:last-child {
      border-bottom: none;
    }

    .meta-label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .meta-value {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    /* ── Review ────────────────────────────────────────────── */
    .review-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .review-bulk-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .review-count {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .review-table-wrapper {
      margin-top: var(--space-4);
    }

    .review-table input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--accent-primary);
    }

    .row-deselected {
      opacity: 0.4;
    }

    .review-pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    .pagination-info {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .btn-sm {
      padding: var(--space-1) var(--space-3);
      font-size: 0.8rem;
    }

    .btn-lg {
      padding: var(--space-3) var(--space-8);
      font-size: 1rem;
    }

    /* ── Progress ──────────────────────────────────────────── */
    .import-progress {
      width: 240px;
      height: 6px;
      background: var(--bg-surface-hover);
      border-radius: 3px;
      overflow: hidden;
      margin-top: var(--space-4);
    }

    .import-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    /* ── Success ───────────────────────────────────────────── */
    .success-screen,
    .error-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12) 0;
      text-align: center;
    }

    .success-icon-wrapper {
      margin-bottom: var(--space-6);
      color: var(--accent-success);
      animation: successPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    @keyframes successPop {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }

    .success-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }

    .success-subtitle {
      color: var(--text-secondary);
      margin-bottom: var(--space-8);
    }

    .success-actions {
      display: flex;
      gap: var(--space-3);
    }

    /* ── Error ─────────────────────────────────────────────── */
    .error-icon-wrapper {
      color: var(--accent-danger);
      margin-bottom: var(--space-6);
    }

    .error-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }

    .error-message {
      color: var(--text-secondary);
      max-width: 400px;
      margin-bottom: var(--space-6);
    }

    /* ── Code tag ──────────────────────────────────────────── */
    .import-module code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.8rem;
      background: rgba(99, 102, 241, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--accent-primary);
    }
  `;
  document.head.appendChild(style);
}

// ─── Exports ────────────────────────────────────────────────────────────────

export default { render, destroy };
