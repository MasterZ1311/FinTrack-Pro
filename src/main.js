/**
 * FinTrack Pro — Application Bootstrap
 * Entry point: runs migration, loads state, initializes router, registers SW.
 */

import './styles/base.css';
import { migrate, getAll } from './db.js';
import { initRouter } from './router.js';
import { store } from './store.js';
import { processRecurring } from './modules/transactions/recurring.js';
import { initSidebar } from './modules/dashboard/sidebar.js';
import { initTopbar } from './modules/dashboard/topbar.js';
import { credentialVault } from './services/credential-vault.js';
import { privacyManager } from './services/privacy-manager.js';

// ─── App Initialization ──────────────────────────────────────────────────────

async function bootstrap() {
  console.log('[FinTrack] Bootstrapping application...');

  try {
    // 1. Run localStorage → IndexedDB migration (idempotent)
    await migrate();
    console.log('[FinTrack] Migration check complete.');

    // 1b. Initialize secure credential vault & privacy manager
    await credentialVault.init();
    await privacyManager.init();

    // 2. Load profile from DB into store
    const profiles = await getAll('profiles');
    if (profiles.length > 0) {
      store.setState('profile', profiles[0]);
      console.log('[FinTrack] Profile loaded:', profiles[0].name || profiles[0].id);
    }

    // 3. Load other data into store
    const [accounts, transactions, budgets, categories, investments] = await Promise.all([
      getAll('accounts'),
      getAll('transactions'),
      getAll('budgets'),
      getAll('categories'),
      getAll('investments'),
    ]);

    store.batchUpdate({
      accounts,
      transactions,
      budgets,
      categories,
      investments,
    });

    // 4. Load settings
    await store.loadSettings();

    console.log('[FinTrack] State hydrated from IndexedDB.');

    // 5. Process any missed recurring transactions (non-blocking)
    processRecurring().catch((err) =>
      console.warn('[FinTrack] Recurring processing error:', err)
    );

    // 6. Mount Sidebar and Topbar
    initSidebar();
    initTopbar();
    console.log('[FinTrack] Sidebar and Topbar mounted.');

    // 7. Initialize the router (handles initial route + profile check)
    await initRouter();
    console.log('[FinTrack] Router initialized.');

    // 8. Register service worker
    registerServiceWorker();

  } catch (err) {
    console.error('[FinTrack] Bootstrap failed:', err);

    // Show error state in the UI
    const appContent = document.getElementById('app-content');
    if (appContent) {
      appContent.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
          <p style="font-size:1.25rem;color:var(--danger,#ef4444);">Failed to initialize FinTrack Pro</p>
          <p style="color:var(--text-secondary,#94a3b8);max-width:400px;text-align:center;">${err.message}</p>
          <button onclick="location.reload()" style="
            padding:10px 24px;
            background:var(--accent,#6366f1);
            color:white;
            border:none;
            border-radius:8px;
            cursor:pointer;
            font-family:inherit;
            font-size:0.9rem;
          ">Retry</button>
        </div>
      `;
    }
  }
}

// ─── Service Worker Registration ──────────────────────────────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('[FinTrack] Service worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('[FinTrack] Service worker registration failed:', err);
      });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', bootstrap);
