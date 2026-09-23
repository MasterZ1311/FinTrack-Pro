/**
 * FinTrack Pro — Privacy Policy Manager
 *
 * Enforces explicit, truthful privacy modes across the application:
 * 1. LOCAL_ONLY (Default): Guaranteed 100% offline/local execution.
 *    Zero external network calls; external AI and remote exchange rates are blocked.
 * 2. PRIVACY_ENHANCED: Non-identifying utility requests (exchange rates) are allowed.
 *    External AI remains strictly blocked.
 * 3. EXTERNAL_AI_ENABLED: Explicit opt-in. Enables external AI providers while
 *    enforcing privacy-safe projections (zero raw transaction logs or account numbers).
 */

import { getById, update as dbUpdate } from '../db.js';
import { store } from '../store.js';

export const PRIVACY_MODES = {
  LOCAL_ONLY: 'LOCAL_ONLY',
  PRIVACY_ENHANCED: 'PRIVACY_ENHANCED',
  EXTERNAL_AI_ENABLED: 'EXTERNAL_AI_ENABLED',
};

const SETTINGS_KEY = 'privacy_mode';

class PrivacyManager {
  constructor() {
    /** @type {string} */
    this._currentMode = PRIVACY_MODES.LOCAL_ONLY; // Default: Local-first guarantee
    this._initialized = false;
  }

  /**
   * Initialize privacy mode from IndexedDB settings during startup.
   */
  async init() {
    try {
      const record = await getById('settings', SETTINGS_KEY);
      if (record && Object.values(PRIVACY_MODES).includes(record.value)) {
        this._currentMode = record.value;
      } else {
        this._currentMode = PRIVACY_MODES.LOCAL_ONLY;
      }
    } catch {
      this._currentMode = PRIVACY_MODES.LOCAL_ONLY;
    }
    this._initialized = true;
    store.setState('privacyMode', this._currentMode);
  }

  /**
   * Get current privacy mode.
   * @returns {string} One of PRIVACY_MODES
   */
  getMode() {
    return this._currentMode;
  }

  /**
   * Set privacy mode.
   * Disablement is immediate: in-memory state updates synchronously,
   * followed by asynchronous persistence to IndexedDB.
   * @param {string} mode
   */
  async setMode(mode) {
    if (!Object.values(PRIVACY_MODES).includes(mode)) {
      throw new Error(`Invalid privacy mode: ${mode}`);
    }

    // 1. Immediate in-memory and store update (synchronous cutoff)
    this._currentMode = mode;
    store.setState('privacyMode', mode);

    // 2. Persist to IndexedDB
    try {
      await dbUpdate('settings', { key: SETTINGS_KEY, value: mode });
    } catch (err) {
      console.warn('[Privacy Manager] Failed to persist privacy mode to IndexedDB:', err.message);
    }
  }

  /**
   * Check if the application is in LOCAL_ONLY mode.
   * @returns {boolean}
   */
  isLocalOnly() {
    return this._currentMode === PRIVACY_MODES.LOCAL_ONLY;
  }

  /**
   * Check if external AI requests are permitted.
   * @returns {boolean}
   */
  isExternalAiAllowed() {
    return this._currentMode === PRIVACY_MODES.EXTERNAL_AI_ENABLED;
  }

  /**
   * Check if exchange rate network requests are permitted.
   * @returns {boolean}
   */
  isExchangeRateAllowed() {
    return this._currentMode !== PRIVACY_MODES.LOCAL_ONLY;
  }
}

export const privacyManager = new PrivacyManager();
export default privacyManager;
