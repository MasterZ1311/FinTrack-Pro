/**
 * FinTrack Pro — Hash-based SPA Router
 * Handles navigation between app modules via hash-based routing.
 * Each route dynamically imports its module for code-splitting.
 */

import { getAll } from './db.js';
import { store } from './store.js';
import { escapeHtml } from './utils/security.js';

// ─── Route Definitions ───────────────────────────────────────────────────────

const routes = {
  '#/onboarding':   () => import('./modules/onboarding/index.js'),
  '#/dashboard':    () => import('./modules/dashboard/index.js'),
  '#/transactions': () => import('./modules/transactions/index.js'),
  '#/analytics':    () => import('./modules/analytics/index.js'),
  '#/budgets':      () => import('./modules/budgets/index.js'),
  '#/accounts':     () => import('./modules/accounts/index.js'),
  '#/ai':           () => import('./modules/ai/index.js'),
  '#/reports':      () => import('./modules/reports/index.js'),
  '#/import':       () => import('./modules/import/index.js'),
  '#/corporate':    () => import('./modules/corporate/index.js'),
  '#/settings':     () => import('./modules/settings/index.js'),
  '#/networth':     () => import('./modules/networth/index.js'),
  '#/investments':  () => import('./modules/investments/index.js'),
};

// Default route
const DEFAULT_ROUTE = '#/dashboard';
const ONBOARDING_ROUTE = '#/onboarding';

/** @type {HTMLElement|null} */
let appContent = null;

/** Currently loaded module (for cleanup) */
let currentModule = null;

// ─── Router Core ──────────────────────────────────────────────────────────────

/**
 * Navigate to a specific route.
 * @param {string} hash - The hash route (e.g., '#/dashboard')
 */
export function navigate(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    // Same hash — force re-render
    handleRouteChange();
  }
}

/**
 * Get the current route hash.
 * @returns {string}
 */
export function getCurrentRoute() {
  return window.location.hash || DEFAULT_ROUTE;
}

/**
 * Handle hash change events — load the appropriate module.
 */
async function handleRouteChange() {
  const hash = getCurrentRoute();

  // Enforce profile check
  if (hash !== ONBOARDING_ROUTE) {
    const hasProfile = await checkProfile();
    if (!hasProfile) return; // checkProfile handles the redirect
  }

  // Update store with current route
  store.setState('currentRoute', hash);

  // Find matching route
  const routeLoader = routes[hash];

  if (!routeLoader) {
    console.warn(`[Router] Unknown route: ${hash}, redirecting to dashboard.`);
    navigate(DEFAULT_ROUTE);
    return;
  }

  // Get the render target
  if (!appContent) {
    appContent = document.getElementById('app-content');
  }

  if (!appContent) {
    console.error('[Router] #app-content element not found.');
    return;
  }

  // Clear main content and show loading state
  appContent.innerHTML = `
    <div class="app-loading">
      <div class="spinner"></div>
    </div>
  `;

  try {
    // Cleanup previous module
    if (currentModule?.destroy) {
      currentModule.destroy();
    }

    // Dynamically import the module
    const module = await routeLoader();

    // Clear loading state
    appContent.innerHTML = '';

    // Each module should export a render function
    if (module.default?.render) {
      currentModule = module.default;
      await module.default.render(appContent);
    } else if (typeof module.render === 'function') {
      currentModule = module;
      await module.render(appContent);
    } else {
      // Module exists but has no render — show placeholder
      const safeName = escapeHtml(hash.replace('#/', ''));
      appContent.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.5;">
          <p style="font-size:1.125rem;color:var(--text-secondary);">
            Module <strong>${safeName}</strong> is coming soon.
          </p>
        </div>
      `;
    }
  } catch (err) {
    console.error(`[Router] Failed to load module for ${hash}:`, err);

    // Show error or placeholder for missing modules
    const safeModuleName = escapeHtml(hash.replace('#/', ''));
    appContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.5;">
        <p style="font-size:1.125rem;color:var(--text-secondary);">
          Module <strong>${safeModuleName}</strong> is coming soon or failed to load.
        </p>
      </div>
    `;
  }
}

// ─── Check Profile & Redirect ─────────────────────────────────────────────────

/**
 * Check if a user profile exists. If not, redirect to onboarding.
 * @returns {Promise<boolean>} true if profile exists
 */
async function checkProfile() {
  try {
    const profiles = await getAll('profiles');
    if (!profiles || profiles.length === 0) {
      console.log('[Router] No profile found — redirecting to onboarding.');
      navigate(ONBOARDING_ROUTE);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Router] Error checking profile:', err);
    return false;
  }
}

// ─── Router Initialization ────────────────────────────────────────────────────

/**
 * Initialize the router: set up listeners and navigate to the initial route.
 */
export async function initRouter() {
  // Cache the render target
  appContent = document.getElementById('app-content');

  // Listen for hash changes
  window.addEventListener('hashchange', handleRouteChange);

  // If no hash set, go to dashboard, else handle the current route
  if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
    navigate(DEFAULT_ROUTE);
  } else {
    handleRouteChange();
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export default {
  navigate,
  getCurrentRoute,
  initRouter,
};
