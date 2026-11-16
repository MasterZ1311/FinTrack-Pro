import { store } from '../../store.js';
import { installApp, isStandalone } from '../../services/pwa-installer.js';

export function initSidebar() {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const navItems = [
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>`, label: 'Dashboard', route: '#/dashboard' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`, label: 'Transactions', route: '#/transactions' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>`, label: 'Analytics', route: '#/analytics' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`, label: 'Budgets', route: '#/budgets' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`, label: 'Accounts', route: '#/accounts' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`, label: 'AI Assistant', route: '#/ai' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`, label: 'Reports', route: '#/reports' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`, label: 'Investments', route: '#/investments' },
    { icon: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>`, label: 'Settings', route: '#/settings' }
  ];

  const getActiveRoute = () => window.location.hash || '#/dashboard';
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  
  const profile = store.state.profile;
  const userName = profile ? (profile.name || profile.companyName || 'My Account') : 'FinTrack Pro';
  const initials = userName.slice(0, 2).toUpperCase();

  const renderNav = () => {
    const active = getActiveRoute();
    return navItems.map(item => `
      <a href="${item.route}" class="nav-item ${active.startsWith(item.route) ? 'active' : ''}">
        <div class="nav-icon">${item.icon}</div>
        <span class="nav-label">${item.label}</span>
      </a>
    `).join('');
  };

  sidebarEl.innerHTML = `
    <div class="sidebar-container ${isCollapsed ? 'collapsed' : ''}" id="sidebar-container">
      <div class="sidebar-logo">
        <div class="nav-icon"><svg width="24" height="24" fill="none" stroke="var(--accent-primary)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
        <span>FinTrack Pro</span>
      </div>
      
      <div class="sidebar-nav" id="sidebar-nav-list">
        ${renderNav()}
      </div>
      
      <div class="sidebar-footer">
        <button class="nav-item install-app-btn" id="sidebar-install-btn" style="width: 100%; border: none; background: rgba(99, 102, 241, 0.12); color: var(--accent-light); margin-bottom: 8px; cursor: pointer; text-align: left;" title="Install FinTrack Pro">
          <div class="nav-icon">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </div>
          <span class="nav-label" id="sidebar-install-label">${isStandalone() ? 'Installed System' : 'Install App'}</span>
        </button>
        <div class="nav-item" style="cursor: default;">
          <div class="avatar">${initials}</div>
          <span class="nav-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</span>
        </div>
        <button class="sidebar-toggle" id="sidebar-toggle-btn" style="margin-top: 16px;" title="Toggle Sidebar">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
        </button>
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const container = document.getElementById('sidebar-container');
  
  const applyCollapsedState = (collapsed) => {
    container.classList.toggle('collapsed', collapsed);
    sidebarEl.classList.toggle('collapsed', collapsed);
    localStorage.setItem('sidebarCollapsed', collapsed);
    if (toggleBtn) {
      toggleBtn.querySelector('svg').style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0)';
    }
  };

  if (isCollapsed) {
    applyCollapsedState(true);
  }

  toggleBtn.addEventListener('click', () => {
    const isNowCollapsed = !container.classList.contains('collapsed');
    applyCollapsedState(isNowCollapsed);
  });

  const installBtn = document.getElementById('sidebar-install-btn');
  const installLabel = document.getElementById('sidebar-install-label');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      await installApp();
    });
  }

  window.addEventListener('pwa-installed', () => {
    if (installLabel) installLabel.textContent = 'Installed System';
  });

  window.addEventListener('pwa-install-ready', () => {
    if (installLabel && !isStandalone()) installLabel.textContent = 'Install App';
  });

  window.addEventListener('toggle-mobile-sidebar', () => {
    container.classList.toggle('mobile-open');
  });

  window.addEventListener('hashchange', () => {
    const navList = document.getElementById('sidebar-nav-list');
    if (navList) navList.innerHTML = renderNav();
  });
}
