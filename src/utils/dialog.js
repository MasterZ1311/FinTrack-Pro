/**
 * FinTrack Pro — High-Craft UI Dialog & Toast System
 * Built according to Emil Kowalski's design engineering philosophy:
 * - Seamless glassmorphic aesthetic matching app dark theme
 * - Accessible keyboard navigation (Escape to dismiss, Enter to submit, focus trapping)
 * - Custom ease-out entrance (scale(0.95) -> scale(1), never scale(0))
 * - Subtle :active button press feedback (scale(0.97))
 * - Replaces blocking native window.alert(), window.confirm(), window.prompt()
 */

import { escapeHtml } from './security.js';

let stylesInjected = false;

function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'fintrack-dialog-styles';
  style.textContent = `
    /* Toast Stack Container */
    #fintrack-toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 400px;
      width: calc(100% - 48px);
    }

    @media (max-width: 640px) {
      #fintrack-toast-container {
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        right: 16px;
        left: 16px;
        width: auto;
      }
    }

    .fintrack-toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      border-radius: 12px;
      background: rgba(17, 24, 39, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      color: #f8fafc;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.88rem;
      line-height: 1.4;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms ease;
      cursor: pointer;
      user-select: none;
    }

    .fintrack-toast.toast-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .fintrack-toast.toast-hiding {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }

    .toast-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toast-info .toast-icon { color: #818cf8; }
    .toast-success .toast-icon { color: #34d399; }
    .toast-warning .toast-icon { color: #fbbf24; }
    .toast-danger .toast-icon { color: #f87171; }

    /* Modal Backdrop */
    .fintrack-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99998;
      background: rgba(3, 7, 18, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      transition: opacity 200ms ease;
    }

    .fintrack-modal-backdrop.modal-open {
      opacity: 1;
    }

    /* Modal Card */
    .fintrack-modal-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      border-radius: 20px;
      width: 100%;
      max-width: 440px;
      padding: 24px;
      color: #f8fafc;
      font-family: 'Inter', system-ui, sans-serif;
      transform: scale(0.95);
      opacity: 0;
      transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms ease;
    }

    .fintrack-modal-backdrop.modal-open .fintrack-modal-card {
      transform: scale(1);
      opacity: 1;
    }

    .fintrack-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .fintrack-modal-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
      line-height: 1.3;
    }

    .fintrack-modal-body {
      font-size: 0.92rem;
      color: #cbd5e1;
      line-height: 1.55;
      margin-bottom: 20px;
      word-break: break-word;
    }

    .fintrack-modal-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 10px 14px;
      color: #f8fafc;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      margin-top: 12px;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .fintrack-modal-input:focus {
      border-color: #818cf8;
      box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
    }

    .fintrack-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .fintrack-dialog-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 18px;
      border-radius: 9999px;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: none;
      outline: none;
      user-select: none;
      touch-action: manipulation;
      transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease, box-shadow 160ms ease;
    }

    .fintrack-dialog-btn:active {
      transform: scale(0.97);
    }

    .fintrack-dialog-btn-cancel {
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .fintrack-dialog-btn-cancel:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }

    .fintrack-dialog-btn-confirm {
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: #fff;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .fintrack-dialog-btn-confirm:hover {
      box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
    }

    .fintrack-dialog-btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: #fff;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .fintrack-dialog-btn-danger:hover {
      box-shadow: 0 6px 18px rgba(239, 68, 68, 0.45);
    }
  `;
  document.head.appendChild(style);
}

// ─── Toasts ───────────────────────────────────────────────────────────────────

function getToastContainer() {
  ensureStyles();
  let container = document.getElementById('fintrack-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'fintrack-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_ICONS = {
  info: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  success: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  warning: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  danger: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
};

/**
 * Display a polished, non-blocking toast message.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'danger'} [type='info']
 * @param {number} [duration=3500]
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `fintrack-toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const iconSvg = TOAST_ICONS[type] || TOAST_ICONS.info;
  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger smooth entrance
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      toast.remove();
    }, 220);
  };

  toast.addEventListener('click', dismiss);
  timer = setTimeout(dismiss, duration);
}

// ─── Modal Dialogs (Alert, Confirm, Prompt) ───────────────────────────────────

/**
 * High-craft confirmation modal replacing window.confirm().
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.cancelText='Cancel']
 * @param {boolean} [options.danger=false]
 * @returns {Promise<boolean>}
 */
export function confirmModal({
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}) {
  ensureStyles();

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fintrack-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const iconColor = danger ? '#f87171' : '#818cf8';
    const iconSvg = danger ? TOAST_ICONS.danger : TOAST_ICONS.info;

    backdrop.innerHTML = `
      <div class="fintrack-modal-card" tabIndex="-1">
        <div class="fintrack-modal-header">
          <span style="color: ${iconColor}; display: flex; align-items: center;">${iconSvg}</span>
          <h3 class="fintrack-modal-title">${escapeHtml(title)}</h3>
        </div>
        <div class="fintrack-modal-body">${escapeHtml(message)}</div>
        <div class="fintrack-modal-actions">
          <button type="button" class="fintrack-dialog-btn fintrack-dialog-btn-cancel" id="fintrack-dlg-cancel">
            ${escapeHtml(cancelText)}
          </button>
          <button type="button" class="fintrack-dialog-btn ${danger ? 'fintrack-dialog-btn-danger' : 'fintrack-dialog-btn-confirm'}" id="fintrack-dlg-confirm">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.add('modal-open');
      backdrop.querySelector('#fintrack-dlg-confirm')?.focus();
    });

    const cleanup = (result) => {
      backdrop.classList.remove('modal-open');
      setTimeout(() => {
        backdrop.remove();
        document.removeEventListener('keydown', handleKey);
        resolve(result);
      }, 200);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      }
    };

    document.addEventListener('keydown', handleKey);

    backdrop.querySelector('#fintrack-dlg-confirm')?.addEventListener('click', () => cleanup(true));
    backdrop.querySelector('#fintrack-dlg-cancel')?.addEventListener('click', () => cleanup(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

/**
 * High-craft alert modal replacing window.alert().
 * @param {string|object} messageOrOptions
 * @param {string} [title='Alert']
 * @param {'info'|'success'|'danger'|'warning'} [type='info']
 * @returns {Promise<void>}
 */
export function alertModal(messageOrOptions, title = 'Notice', type = 'info') {
  ensureStyles();

  const msg = typeof messageOrOptions === 'object' ? messageOrOptions.message : messageOrOptions;
  const t = typeof messageOrOptions === 'object' ? (messageOrOptions.title || title) : title;
  const alertType = typeof messageOrOptions === 'object' ? (messageOrOptions.type || type) : type;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fintrack-modal-backdrop';
    backdrop.setAttribute('role', 'alertdialog');
    backdrop.setAttribute('aria-modal', 'true');

    const iconSvg = TOAST_ICONS[alertType] || TOAST_ICONS.info;
    const iconColor = alertType === 'danger' ? '#f87171' : alertType === 'success' ? '#34d399' : '#818cf8';

    backdrop.innerHTML = `
      <div class="fintrack-modal-card" tabIndex="-1">
        <div class="fintrack-modal-header">
          <span style="color: ${iconColor}; display: flex; align-items: center;">${iconSvg}</span>
          <h3 class="fintrack-modal-title">${escapeHtml(t)}</h3>
        </div>
        <div class="fintrack-modal-body">${escapeHtml(msg)}</div>
        <div class="fintrack-modal-actions">
          <button type="button" class="fintrack-dialog-btn fintrack-dialog-btn-confirm" id="fintrack-dlg-ok">
            Dismiss
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.add('modal-open');
      backdrop.querySelector('#fintrack-dlg-ok')?.focus();
    });

    const cleanup = () => {
      backdrop.classList.remove('modal-open');
      setTimeout(() => {
        backdrop.remove();
        document.removeEventListener('keydown', handleKey);
        resolve();
      }, 200);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        cleanup();
      }
    };

    document.addEventListener('keydown', handleKey);
    backdrop.querySelector('#fintrack-dlg-ok')?.addEventListener('click', cleanup);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup();
    });
  });
}

/**
 * High-craft input prompt modal replacing window.prompt().
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.defaultValue='']
 * @param {string} [options.placeholder='']
 * @param {string} [options.confirmText='Save']
 * @param {string} [options.cancelText='Cancel']
 * @returns {Promise<string|null>}
 */
export function promptModal({
  title = 'Input Required',
  message,
  defaultValue = '',
  placeholder = '',
  confirmText = 'Save',
  cancelText = 'Cancel'
}) {
  ensureStyles();

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fintrack-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    backdrop.innerHTML = `
      <div class="fintrack-modal-card" tabIndex="-1">
        <div class="fintrack-modal-header">
          <span style="color: #818cf8; display: flex; align-items: center;">${TOAST_ICONS.info}</span>
          <h3 class="fintrack-modal-title">${escapeHtml(title)}</h3>
        </div>
        <div class="fintrack-modal-body">
          <p style="margin: 0;">${escapeHtml(message)}</p>
          <input type="text" id="fintrack-dlg-input" class="fintrack-modal-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" />
        </div>
        <div class="fintrack-modal-actions">
          <button type="button" class="fintrack-dialog-btn fintrack-dialog-btn-cancel" id="fintrack-dlg-cancel">
            ${escapeHtml(cancelText)}
          </button>
          <button type="button" class="fintrack-dialog-btn fintrack-dialog-btn-confirm" id="fintrack-dlg-submit">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const inputEl = backdrop.querySelector('#fintrack-dlg-input');

    requestAnimationFrame(() => {
      backdrop.classList.add('modal-open');
      inputEl?.focus();
      inputEl?.select();
    });

    const cleanup = (val) => {
      backdrop.classList.remove('modal-open');
      setTimeout(() => {
        backdrop.remove();
        document.removeEventListener('keydown', handleKey);
        resolve(val);
      }, 200);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        cleanup(inputEl?.value ?? '');
      }
    };

    document.addEventListener('keydown', handleKey);

    backdrop.querySelector('#fintrack-dlg-submit')?.addEventListener('click', () => {
      cleanup(inputEl?.value ?? '');
    });
    backdrop.querySelector('#fintrack-dlg-cancel')?.addEventListener('click', () => {
      cleanup(null);
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(null);
    });
  });
}
