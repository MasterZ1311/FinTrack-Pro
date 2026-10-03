import { store } from '../../store.js';
import { escapeHtml } from '../../utils/security.js';

export function initTopbar() {
  const topbarEl = document.getElementById('topbar');
  if (!topbarEl) return;

  let currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const getPageTitle = () => {
    const rawHash = (window.location.hash || '#/dashboard').replace(/^#\//, '');
    const cleanHash = rawHash.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanHash || cleanHash === 'dashboard') return 'Dashboard';
    if (cleanHash === 'ai') return 'AI Assistant';
    if (cleanHash === 'networth') return 'Net Worth';
    if (cleanHash === 'import') return 'Import Data';
    return cleanHash.charAt(0).toUpperCase() + cleanHash.slice(1);
  };

  topbarEl.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-6); background: var(--bg-surface); backdrop-filter: var(--glass-blur); border-bottom: var(--glass-border); position: sticky; top: 0; z-index: 40;">
      <div style="display: flex; align-items: center; gap: var(--space-4);">
        <button class="btn-ghost mobile-menu-btn" id="mobile-menu-btn" style="display: none; padding: var(--space-2);">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
        <h1 id="topbar-page-title" style="font-size: 1.5rem; font-weight: 600; margin: 0;">${escapeHtml(getPageTitle())}</h1>
      </div>
      
      <div style="display: flex; align-items: center; gap: var(--space-4);">
        <button class="btn-ghost" id="theme-toggle" title="Toggle Theme">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
        </button>
        
        <div style="position: relative;">
          <button class="btn-ghost" id="notifications-btn" title="Notifications" style="position: relative;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            <span style="position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; background: var(--accent-danger); border-radius: 50%; animation: pulse-glow 2s infinite;"></span>
          </button>
        </div>
      </div>
    </header>
  `;

  // Handle Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    const themes = ['dark', 'light', 'oled'];
    const currentIndex = themes.indexOf(currentTheme);
    currentTheme = themes[(currentIndex + 1) % themes.length];
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
  });

  // Handle Notifications
  const notifBtn = document.getElementById('notifications-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      store.notify({
        type: 'info',
        message: 'No new critical alerts. Your accounts and budgets are in sync.',
        duration: 4000,
      });
    });
  }

  // Handle Mobile Menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  mobileMenuBtn.addEventListener('click', () => {
    window.dispatchEvent(new Event('toggle-mobile-sidebar'));
  });

  const mql = window.matchMedia('(max-width: 768px)');
  const handleResize = (e) => {
    mobileMenuBtn.style.display = e.matches ? 'block' : 'none';
  };
  mql.addEventListener('change', handleResize);
  handleResize(mql);

  window.addEventListener('hashchange', () => {
    const titleEl = document.getElementById('topbar-page-title');
    if (titleEl) titleEl.textContent = getPageTitle();
  });
}
