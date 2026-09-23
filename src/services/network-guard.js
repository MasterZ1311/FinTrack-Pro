/**
 * FinTrack Pro — Centralized Network Guard & Request Gatekeeper
 *
 * Intercepts outbound requests and enforces active privacy policy:
 * - In LOCAL_ONLY mode: Strictly blocks external AI and remote exchange rates.
 * - In PRIVACY_ENHANCED mode: Allows exchange rates, blocks external AI.
 * - In EXTERNAL_AI_ENABLED mode: Allows external AI with scrubbed credentials.
 * - Redacts all secrets and credentials from network logs and exceptions.
 */

import { privacyManager, PRIVACY_MODES } from './privacy-manager.js';
import { credentialVault } from './credential-vault.js';

export class PrivacyViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PrivacyViolationError';
    this.details = details;
  }
}

/**
 * Check whether an outbound request category is permitted under current policy.
 * @param {'ai_external' | 'exchange_rate' | 'local_service'} category
 * @param {string} [destination='']
 * @returns {boolean}
 */
export function canMakeRequest(category, destination = '') {
  const mode = privacyManager.getMode();

  // Local loopback is always permitted (e.g. Ollama localhost:11434)
  if (destination.includes('localhost') || destination.includes('127.0.0.1')) {
    return true;
  }

  if (mode === PRIVACY_MODES.LOCAL_ONLY) {
    return false;
  }

  if (category === 'ai_external') {
    return mode === PRIVACY_MODES.EXTERNAL_AI_ENABLED;
  }

  if (category === 'exchange_rate') {
    return mode === PRIVACY_MODES.PRIVACY_ENHANCED || mode === PRIVACY_MODES.EXTERNAL_AI_ENABLED;
  }

  return false;
}

/**
 * Guarded fetch wrapper that enforces privacy policy prior to executing any HTTP call.
 *
 * @param {string | URL} url - Target URL
 * @param {RequestInit} [options={}] - Standard fetch options
 * @param {object} [meta={}]
 * @param {'ai_external' | 'exchange_rate' | 'local_service'} [meta.category='ai_external']
 * @param {string} [meta.description='']
 * @returns {Promise<Response>}
 */
export async function guardFetch(url, options = {}, meta = {}) {
  const urlStr = String(url);
  const category = meta.category || 'ai_external';
  const description = meta.description || 'Outbound network operation';

  // 1. Enforce privacy policy
  if (!canMakeRequest(category, urlStr)) {
    const currentMode = privacyManager.getMode();
    throw new PrivacyViolationError(
      `[Privacy Guard] ${description} blocked. Current privacy mode is "${currentMode}". Financial data must remain on device.`,
      { category, url: redactUrl(urlStr), currentMode }
    );
  }

  // 2. Execute fetch safely with credential-scrubbed error handling
  try {
    const response = await fetch(url, options);
    return response;
  } catch (err) {
    const scrubbedMsg = credentialVault.scrubSensitive(err.message || String(err));
    throw new Error(`[Network Error] ${scrubbedMsg}`);
  }
}

/**
 * Redact API keys from URL strings for logging and error reporting.
 * @param {string} url
 * @returns {string}
 */
export function redactUrl(url) {
  if (!url) return '';
  return String(url).replace(/([?&](?:key|apiKey|api_key)=)[^&]+/gi, '$1[REDACTED]');
}

export default {
  guardFetch,
  canMakeRequest,
  redactUrl,
  PrivacyViolationError,
};
