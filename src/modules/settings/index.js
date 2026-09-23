import { store } from '../../store.js';
import { update, clear } from '../../db.js';
import { credentialVault } from '../../services/credential-vault.js';
import { privacyManager } from '../../services/privacy-manager.js';
import { PROVIDER_ENDPOINTS } from '../../services/user-api.js';
import { escapeHtml } from '../../utils/security.js';

export async function render(container) {
  const profile = store.getState('profile') || {};
  const privacyMode = privacyManager.getMode();
  const hasLegacy = credentialVault.hasLegacyPlaintextCredentials();
  const isVaultUnlocked = credentialVault.isUnlocked();
  const hasStoredCreds = await credentialVault.hasCredentials();
  const activeCreds = credentialVault.getCredentials();
  const currentProvider = activeCreds?.provider || 'gemini';

  container.innerHTML = `
    <div class="settings-container" style="max-width: 800px; margin: 0 auto; padding-bottom: var(--space-8);">
      <h2 style="margin-bottom: var(--space-6); font-size: 1.5rem; font-weight: 600;">Settings</h2>
      
      <div class="tabs" style="display: flex; gap: var(--space-4); margin-bottom: var(--space-6); border-bottom: 1px solid var(--border-subtle);">
        <button class="tab-btn active" data-target="tab-profile" style="background: none; border: none; color: var(--text-primary); padding: var(--space-2) 0; cursor: pointer; border-bottom: 2px solid var(--accent-primary); font-weight: 500;">Profile</button>
        <button class="tab-btn" data-target="tab-prefs" style="background: none; border: none; color: var(--text-secondary); padding: var(--space-2) 0; cursor: pointer; font-weight: 500;">Preferences</button>
        <button class="tab-btn" data-target="tab-ai" style="background: none; border: none; color: var(--text-secondary); padding: var(--space-2) 0; cursor: pointer; font-weight: 500;">Privacy &amp; AI</button>
        <button class="tab-btn" data-target="tab-data" style="background: none; border: none; color: var(--text-secondary); padding: var(--space-2) 0; cursor: pointer; font-weight: 500;">Data Management</button>
      </div>

      <div class="tab-content">
        <!-- Profile Tab -->
        <div id="tab-profile" class="tab-pane glass-card" style="display: block;">
          <h3 style="margin-bottom: var(--space-4);">Profile Information</h3>
          <form id="profile-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
            <div>
              <label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.875rem;">Name</label>
              <input type="text" id="prof-name" class="input-field" value="${escapeHtml(profile.name || '')}" required>
            </div>
            <div>
              <label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.875rem;">Base Currency</label>
              <select id="prof-currency" class="select-field">
                <option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${profile.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="GBP" ${profile.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                <option value="INR" ${profile.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
              </select>
            </div>
            <div>
              <label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.875rem;">Monthly Income</label>
              <input type="number" id="prof-income" class="input-field" value="${escapeHtml(profile.monthlyIncome || '')}">
            </div>
            <div>
              <label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.875rem;">Financial Goals</label>
              <textarea id="prof-goals" class="input-field" style="resize: vertical; min-height: 80px;" placeholder="E.g., Save $5000 for a car...">${escapeHtml(profile.goals || '')}</textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="align-self: flex-start; margin-top: var(--space-2);">Save Profile</button>
          </form>
        </div>

        <!-- Preferences Tab -->
        <div id="tab-prefs" class="tab-pane glass-card" style="display: none;">
          <h3 style="margin-bottom: var(--space-4);">App Preferences</h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-4);">
            <div>
              <label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.875rem;">Theme</label>
              <select id="pref-theme" class="select-field">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="oled">OLED (True Black)</option>
              </select>
            </div>
            <div>
              <label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.875rem;">Language</label>
              <select id="pref-lang" class="select-field">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Privacy & AI Tab -->
        <div id="tab-ai" class="tab-pane glass-card" style="display: none;">
          <h3 style="margin-bottom: var(--space-4);">Privacy &amp; AI Configuration</h3>

          <!-- Privacy Policy Mode Box -->
          <div style="background: rgba(0,0,0,0.18); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-6);">
            <h4 style="margin: 0 0 var(--space-2); font-size: 1rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              🛡️ Privacy &amp; Network Mode
            </h4>
            <p style="margin: 0 0 var(--space-3); font-size: 0.85rem; color: var(--text-secondary);">
              FinTrack Pro is local-first. Choose how strictly network operations are bounded on your device.
            </p>
            <div style="display: flex; flex-direction: column; gap: var(--space-3);">
              <label style="display: flex; align-items: flex-start; gap: var(--space-3); cursor: pointer;">
                <input type="radio" name="privacy-mode-radio" value="LOCAL_ONLY" ${privacyMode === 'LOCAL_ONLY' ? 'checked' : ''} style="margin-top: 3px;">
                <div>
                  <strong style="color: var(--accent-success, #10b981);">LOCAL_ONLY (Default &amp; Recommended)</strong>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                    100% offline. Zero external network requests. External AI and remote exchange rates are blocked.
                  </div>
                </div>
              </label>

              <label style="display: flex; align-items: flex-start; gap: var(--space-3); cursor: pointer;">
                <input type="radio" name="privacy-mode-radio" value="PRIVACY_ENHANCED" ${privacyMode === 'PRIVACY_ENHANCED' ? 'checked' : ''} style="margin-top: 3px;">
                <div>
                  <strong style="color: var(--accent-primary, #6366f1);">PRIVACY_ENHANCED</strong>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                    Allows remote exchange rate updates (sends currency code only). External AI remains strictly blocked.
                  </div>
                </div>
              </label>

              <label style="display: flex; align-items: flex-start; gap: var(--space-3); cursor: pointer;">
                <input type="radio" name="privacy-mode-radio" value="EXTERNAL_AI_ENABLED" ${privacyMode === 'EXTERNAL_AI_ENABLED' ? 'checked' : ''} style="margin-top: 3px;">
                <div>
                  <strong style="color: var(--accent-warning, #f59e0b);">EXTERNAL_AI_ENABLED</strong>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                    Enables external AI providers (Gemini, OpenAI, Groq, Anthropic). Sends only aggregated, privacy-safe projections (zero account numbers or notes).
                  </div>
                </div>
              </label>
            </div>
            <button id="save-privacy-btn" class="btn btn-secondary btn-sm" style="margin-top: var(--space-3);">Save Privacy Mode</button>
          </div>

          <!-- Legacy Plaintext Migration Alert -->
          ${hasLegacy ? `
          <div id="legacy-migration-card" style="background: rgba(245, 158, 11, 0.12); border: 1px solid var(--accent-warning, #f59e0b); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-6);">
            <h4 style="margin: 0 0 var(--space-1); color: var(--accent-warning, #f59e0b);">⚠️ Plaintext API Key Detected in Browser Storage</h4>
            <p style="margin: 0 0 var(--space-3); font-size: 0.85rem; color: var(--text-primary);">
              An unencrypted legacy API key was found in localStorage. Enter a security passphrase below to encrypt it into IndexedDB via Web Crypto AES-256-GCM, or discard it.
            </p>
            <div style="display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap;">
              <input type="password" id="legacy-passphrase" class="input-field" placeholder="Create Vault Passphrase" style="max-width: 250px;">
              <button id="btn-migrate-legacy" class="btn btn-primary btn-sm">Encrypt &amp; Migrate</button>
              <button id="btn-discard-legacy" class="btn btn-ghost btn-sm" style="color: var(--accent-danger, #ef4444);">Discard Legacy Key</button>
            </div>
          </div>
          ` : ''}

          <!-- Credential Vault Section -->
          <div style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">🔒 Encrypted Credential Vault</h4>
              <span id="vault-status-badge" style="background: ${isVaultUnlocked ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${isVaultUnlocked ? '#10b981' : '#ef4444'}; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 0.8rem;">
                ${isVaultUnlocked ? 'Unlocked 🔓' : hasStoredCreds ? 'Locked 🔒' : 'Not Configured'}
              </span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: var(--space-4);">
              Keys are encrypted at rest in IndexedDB using AES-256-GCM + PBKDF2 (100,000 iterations). Passphrases are never saved to disk.
            </p>

            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              <div>
                <label style="display: block; margin-bottom: var(--space-1); font-size: 0.875rem; color: var(--text-secondary);">Provider</label>
                <select id="ai-provider" class="select-field">
                  <option value="gemini" ${currentProvider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                  <option value="openai" ${currentProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
                  <option value="groq" ${currentProvider === 'groq' ? 'selected' : ''}>Groq</option>
                  <option value="anthropic" ${currentProvider === 'anthropic' ? 'selected' : ''}>Anthropic Claude</option>
                  <option value="ollama" ${currentProvider === 'ollama' ? 'selected' : ''}>Ollama (Localhost)</option>
                </select>
                <div id="endpoint-display" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-family: monospace;">
                  Active Endpoint: ${PROVIDER_ENDPOINTS[currentProvider] || ''}
                </div>
              </div>

              <div>
                <label style="display: block; margin-bottom: var(--space-1); font-size: 0.875rem; color: var(--text-secondary);">API Key</label>
                <input type="password" id="ai-api-key" class="input-field" placeholder="${hasStoredCreds ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter API Key'}" autocomplete="off">
              </div>

              <div>
                <label style="display: block; margin-bottom: var(--space-1); font-size: 0.875rem; color: var(--text-secondary);">Vault Passphrase</label>
                <input type="password" id="vault-passphrase" class="input-field" placeholder="Enter passphrase to save or unlock" autocomplete="off">
              </div>

              <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-2);">
                <button id="save-ai-btn" class="btn btn-primary">Encrypt &amp; Save Key</button>
                ${hasStoredCreds && !isVaultUnlocked ? `<button id="btn-unlock-vault" class="btn btn-secondary">Unlock Vault</button>` : ''}
                ${isVaultUnlocked ? `<button id="btn-lock-vault" class="btn btn-secondary">Lock Vault</button>` : ''}
                ${hasStoredCreds ? `<button id="btn-clear-creds" class="btn btn-ghost" style="color:var(--accent-danger, #ef4444);">Delete Key</button>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Data Management Tab -->
        <div id="tab-data" class="tab-pane glass-card" style="display: none;">
          <h3 style="margin-bottom: var(--space-4);">Data Management</h3>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-6); font-size: 0.875rem;">Export your financial data for backup or permanently delete everything from your device.</p>
          
          <div style="display: flex; gap: var(--space-4);">
            <button id="btn-export-data" class="btn btn-secondary">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Export All Data (JSON)
            </button>
            <button id="btn-wipe-data" class="btn btn-danger">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Wipe All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachEventListeners(container);
}

function attachEventListeners(container) {
  // Tab Switching logic
  const tabBtns = container.querySelectorAll('.tab-btn');
  const tabPanes = container.querySelectorAll('.tab-pane');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.style.borderBottom = 'none';
        b.style.color = 'var(--text-secondary)';
      });
      tabPanes.forEach((p) => (p.style.display = 'none'));

      btn.classList.add('active');
      btn.style.borderBottom = '2px solid var(--accent-primary)';
      btn.style.color = 'var(--text-primary)';
      const target = btn.getAttribute('data-target');
      const pane = container.querySelector(`#${target}`);
      if (pane) pane.style.display = 'block';
    });
  });

  // Load current theme
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const prefTheme = container.querySelector('#pref-theme');
  if (prefTheme) {
    prefTheme.value = currentTheme;
    prefTheme.addEventListener('change', (e) => {
      const val = e.target.value;
      document.documentElement.setAttribute('data-theme', val);
      localStorage.setItem('theme', val);
    });
  }

  // Profile Form
  const profileForm = container.querySelector('#profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profile = store.getState('profile') || {};
      profile.name = container.querySelector('#prof-name').value;
      profile.currency = container.querySelector('#prof-currency').value;
      profile.monthlyIncome = parseFloat(container.querySelector('#prof-income').value) || 0;
      profile.goals = container.querySelector('#prof-goals').value;

      await update('profiles', profile);
      store.setState('profile', profile);
      alert('Profile saved successfully!');
    });
  }

  // Provider change update endpoint display
  const providerSelect = container.querySelector('#ai-provider');
  const endpointDisplay = container.querySelector('#endpoint-display');
  if (providerSelect && endpointDisplay) {
    providerSelect.addEventListener('change', () => {
      const provider = providerSelect.value;
      endpointDisplay.textContent = `Active Endpoint: ${PROVIDER_ENDPOINTS[provider] || ''}`;
    });
  }

  // Privacy Mode save
  const savePrivacyBtn = container.querySelector('#save-privacy-btn');
  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener('click', async () => {
      const selected = container.querySelector('input[name="privacy-mode-radio"]:checked');
      if (selected) {
        await privacyManager.setMode(selected.value);
        store.notify({
          type: 'success',
          message: `Privacy mode updated to ${selected.value}`,
        });
      }
    });
  }

  // Legacy Migration
  const btnMigrate = container.querySelector('#btn-migrate-legacy');
  if (btnMigrate) {
    btnMigrate.addEventListener('click', async () => {
      const pass = container.querySelector('#legacy-passphrase')?.value;
      if (!pass) {
        alert('Please enter a passphrase to encrypt your legacy key.');
        return;
      }
      try {
        await credentialVault.migrateLegacyCredentials(pass);
        store.notify({ type: 'success', message: 'Legacy key encrypted into vault successfully!' });
        render(container);
      } catch (err) {
        alert(`Migration failed: ${err.message}`);
      }
    });
  }

  const btnDiscard = container.querySelector('#btn-discard-legacy');
  if (btnDiscard) {
    btnDiscard.addEventListener('click', () => {
      if (confirm('Discard unencrypted legacy key?')) {
        credentialVault.discardLegacyCredentials();
        store.notify({ type: 'info', message: 'Legacy key purged from browser storage.' });
        render(container);
      }
    });
  }

  // Save AI Credentials
  const saveAiBtn = container.querySelector('#save-ai-btn');
  if (saveAiBtn) {
    saveAiBtn.addEventListener('click', async () => {
      const provider = providerSelect.value;
      const key = container.querySelector('#ai-api-key').value;
      const pass = container.querySelector('#vault-passphrase').value;

      if (!pass) {
        alert('Please enter a vault passphrase to encrypt your key.');
        return;
      }

      const existing = credentialVault.getCredentials();
      const apiKeyToSave = key || existing?.apiKey;

      if (!apiKeyToSave) {
        alert('Please enter an API key.');
        return;
      }

      try {
        await credentialVault.storeCredentials(
          'ai_config',
          { provider, apiKey: apiKeyToSave, model: 'gemini-1.5-flash' },
          pass
        );
        store.notify({ type: 'success', message: 'API credentials encrypted and saved!' });
        render(container);
      } catch (err) {
        alert(`Failed to encrypt and store credentials: ${err.message}`);
      }
    });
  }

  // Unlock Vault
  const btnUnlock = container.querySelector('#btn-unlock-vault');
  if (btnUnlock) {
    btnUnlock.addEventListener('click', async () => {
      const pass = container.querySelector('#vault-passphrase').value;
      if (!pass) {
        alert('Please enter your vault passphrase.');
        return;
      }
      try {
        await credentialVault.unlock(pass);
        store.notify({ type: 'success', message: 'Vault unlocked!' });
        render(container);
      } catch (err) {
        alert(`Failed to unlock vault: ${err.message}`);
      }
    });
  }

  // Lock Vault
  const btnLock = container.querySelector('#btn-lock-vault');
  if (btnLock) {
    btnLock.addEventListener('click', () => {
      credentialVault.lock();
      store.notify({ type: 'info', message: 'Vault locked. In-memory keys cleared.' });
      render(container);
    });
  }

  // Clear Credentials
  const btnClearCreds = container.querySelector('#btn-clear-creds');
  if (btnClearCreds) {
    btnClearCreds.addEventListener('click', async () => {
      if (confirm('Delete stored API credentials?')) {
        await credentialVault.deleteCredentials('ai_config');
        store.notify({ type: 'info', message: 'API credentials deleted.' });
        render(container);
      }
    });
  }

  // Export Data (Guaranteed Zero Credentials)
  const btnExport = container.querySelector('#btn-export-data');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const data = {
        profile: store.getState('profile'),
        accounts: store.getState('accounts'),
        transactions: store.getState('transactions'),
        categories: store.getState('categories'),
        budgets: store.getState('budgets'),
      };

      // Strict guarantee: Exclude credentials, keys, and passphrases
      delete data.credentials;
      delete data.apiKey;
      delete data.passphrase;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Wipe Data
  const btnWipe = container.querySelector('#btn-wipe-data');
  if (btnWipe) {
    btnWipe.addEventListener('click', async () => {
      if (confirm('Are you absolutely sure you want to wipe ALL data? This action cannot be undone.')) {
        if (confirm('Final warning: All accounts, transactions, and settings will be deleted.')) {
          await clear('profiles');
          await clear('accounts');
          await clear('transactions');
          await clear('categories');
          await clear('budgets');
          await credentialVault.clearAll();
          localStorage.clear();

          window.location.hash = '#/onboarding';
          window.location.reload();
        }
      }
    });
  }
}

export default {
  render,
};
