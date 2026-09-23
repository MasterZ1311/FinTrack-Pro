/**
 * FinTrack Pro — Centralized Security & DOM Hardening Utilities
 *
 * Provides deterministic HTML escaping, attribute encoding, URL sanitization,
 * and an auto-escaping `html` tagged template literal helper to defend against XSS.
 */

import DOMPurify from 'dompurify';

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

const ESCAPE_REGEX = /[&<>"'`]/g;

/**
 * Deterministically escape HTML special characters.
 * Safe for both HTML body text and quoted HTML attributes.
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(ESCAPE_REGEX, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Alias for escapeHtml, specifically for HTML attribute values.
 * @param {any} str
 * @returns {string}
 */
export function safeAttr(str) {
  return escapeHtml(str);
}

/**
 * Validate and sanitize URLs to prevent javascript: or malicious data: execution.
 * Allows http, https, and safe image data URIs (PNG, JPEG, WebP, GIF).
 *
 * @param {string} url
 * @param {object} [options={}]
 * @param {boolean} [options.allowDataImages=true]
 * @returns {string} Safe URL or 'about:blank'
 */
export function safeUrl(url, { allowDataImages = true } = {}) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Strip control characters
  const normalized = trimmed.replace(/[\x00-\x20]/g, '').toLowerCase();

  // Block dangerous schemes
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) {
    return 'about:blank';
  }

  // Handle data URIs
  if (normalized.startsWith('data:')) {
    if (allowDataImages && /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
      return trimmed;
    }
    return 'about:blank';
  }

  return trimmed;
}

/**
 * Sanitize rich HTML using DOMPurify.
 * @param {string} dirty
 * @param {object} [options={}]
 * @returns {string} Clean HTML
 */
export function sanitizeHtml(dirty, options = {}) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, options);
}

/**
 * Safely set the innerHTML of a target element using DOMPurify.
 * @param {HTMLElement} element
 * @param {string} dirty
 * @param {object} [options={}]
 */
export function safeSetHtml(element, dirty, options = {}) {
  if (!element) return;
  element.innerHTML = sanitizeHtml(dirty, options);
}

// ─── Tagged Template Literal Helper ──────────────────────────────────────────

export class SafeString {
  constructor(value) {
    this.value = String(value);
  }
  toString() {
    return this.value;
  }
}

/**
 * Mark a string as safe raw HTML that should not be escaped by `html`.
 * @param {any} val
 * @returns {SafeString}
 */
export function raw(val) {
  return new SafeString(val == null ? '' : String(val));
}

/**
 * Tagged template literal that auto-escapes all dynamic expressions
 * while preserving static template markup.
 *
 * Example:
 *   html`<div class="desc">${tx.description}</div>`
 */
export function html(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const val = i < values.length ? values[i] : '';
    let formatted = '';
    if (val instanceof SafeString) {
      formatted = val.value;
    } else if (Array.isArray(val)) {
      formatted = val
        .map((item) => (item instanceof SafeString ? item.value : escapeHtml(item)))
        .join('');
    } else {
      formatted = escapeHtml(val);
    }
    return acc + str + formatted;
  }, '');
}

export default {
  escapeHtml,
  safeAttr,
  safeUrl,
  sanitizeHtml,
  safeSetHtml,
  html,
  raw,
  SafeString,
};
