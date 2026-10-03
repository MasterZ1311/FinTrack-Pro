/**
 * @vitest-environment jsdom
 * FinTrack Pro — Unit Tests: Security & DOM Sanitization Utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  escapeHtml,
  safeAttr,
  safeUrl,
  sanitizeHtml,
  safeSetHtml,
  html,
} from '../../src/utils/security.js';

describe('Security & DOM Sanitization Utilities (src/utils/security.js)', () => {
  describe('escapeHtml()', () => {
    it('escapes standard HTML special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
      expect(escapeHtml("Tom & Jerry's `code`")).toBe(
        'Tom &amp; Jerry&#39;s &#96;code&#96;'
      );
    });

    it('safely handles non-string or empty inputs', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(0)).toBe('0');
      expect(escapeHtml(false)).toBe('false');
    });

    it('neutralizes malicious SVG and event handlers', () => {
      const payload = '<svg onload=alert(1)>';
      expect(escapeHtml(payload)).toBe('&lt;svg onload=alert(1)&gt;');
    });
  });

  describe('safeAttr()', () => {
    it('escapes attribute quotes and dangerous characters', () => {
      const payload = 'test" onclick="alert(1)"';
      expect(safeAttr(payload)).toBe('test&quot; onclick=&quot;alert(1)&quot;');
    });
  });

  describe('safeUrl()', () => {
    it('allows safe http, https, and relative URLs', () => {
      expect(safeUrl('https://example.com/api')).toBe('https://example.com/api');
      expect(safeUrl('http://localhost:3000')).toBe('http://localhost:3000');
      expect(safeUrl('/dashboard')).toBe('/dashboard');
      expect(safeUrl('#/transactions')).toBe('#/transactions');
    });

    it('blocks dangerous protocols like javascript: and data:', () => {
      expect(safeUrl('javascript:alert(1)')).toBe('about:blank');
      expect(safeUrl('JAVASCRIPT:alert(1)')).toBe('about:blank');
      expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('about:blank');
      expect(safeUrl('vbscript:msgbox(1)')).toBe('about:blank');
    });

    it('returns empty string for invalid or empty inputs', () => {
      expect(safeUrl('')).toBe('');
      expect(safeUrl(null)).toBe('');
      expect(safeUrl(undefined)).toBe('');
    });
  });

  describe('sanitizeHtml() & safeSetHtml()', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
    });

    it('strips active execution payloads like <script> and onerror', () => {
      const dirty = '<div>Hello <script>alert(1)</script><img src=x onerror=alert(2)></div>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror');
      expect(clean).toContain('Hello');
    });

    it('safely updates element DOM via safeSetHtml()', () => {
      const dirty = '<p>Safe paragraph</p><img src=x onerror=alert(1)>';
      safeSetHtml(container, dirty);
      expect(container.querySelector('p')).not.toBeNull();
      expect(container.querySelector('p').textContent).toBe('Safe paragraph');
      expect(container.innerHTML).not.toContain('onerror');
    });
  });

  describe('html tagged template', () => {
    it('automatically escapes interpolated variable values', () => {
      const userInput = '<script>alert(1)</script>';
      const template = html`<div class="user-greeting">Hello ${userInput}!</div>`;
      expect(template).toBe(
        '<div class="user-greeting">Hello &lt;script&gt;alert(1)&lt;/script&gt;!</div>'
      );
    });

    it('handles multiple dynamic variables with arrays and numbers', () => {
      const name = 'Alice & Bob';
      const count = 5;
      const template = html`<span>${name} has ${count} items</span>`;
      expect(template).toBe('<span>Alice &amp; Bob has 5 items</span>');
    });
  });
});
