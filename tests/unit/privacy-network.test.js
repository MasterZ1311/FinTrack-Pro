/**
 * FinTrack Pro — Unit Tests: Privacy Manager, Projection & Network Guard
 *
 * Verifies:
 * - createPrivacySafeSummary strips all account numbers, card numbers, UTRs, IDs, and notes
 * - Aggregated financial metrics are accurately calculated
 * - scrubPII sanitizes sensitive strings
 * - privacyManager maintains truthful privacy modes with immediate cutoff
 * - networkGuard blocks unauthorized outbound requests with PrivacyViolationError
 * - URL and error credential scrubbing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { privacyManager, PRIVACY_MODES } from '../../src/services/privacy-manager.js';
import { createPrivacySafeSummary, scrubPII } from '../../src/services/privacy-projection.js';
import { canMakeRequest, guardFetch, redactUrl, PrivacyViolationError } from '../../src/services/network-guard.js';
import { resetDatabase } from '../helpers/db-helper.js';

describe('Privacy & Network Unit Suite', () => {
  beforeEach(async () => {
    await resetDatabase();
    await privacyManager.setMode(PRIVACY_MODES.LOCAL_ONLY);
  });

  describe('createPrivacySafeSummary() & scrubPII()', () => {
    it('strips card numbers, account numbers, UTRs, transaction IDs, and raw notes', () => {
      const sensitiveRawData = {
        profile: {
          name: 'Arjun Sharma',
          currency: 'INR',
          panNumber: 'ABCDE1234F',
          email: 'arjun@example.com',
          phone: '+91 9876543210',
        },
        accounts: [
          {
            id: 'acc-secret-999',
            name: 'HDFC Salary Account',
            accountNumber: '50100234567890',
            balance: 150000,
          },
        ],
        transactions: [
          {
            id: 'tx-uuid-1111-2222',
            accountId: 'acc-secret-999',
            date: new Date().toISOString().slice(0, 10),
            amount: 75000,
            type: 'income',
            category: 'Salary',
            notes: 'Monthly salary credited with ref NEFT-HDFC000123456789 from employer',
            utrNumber: 'UPI/123456789012',
          },
          {
            id: 'tx-uuid-3333-4444',
            accountId: 'acc-secret-999',
            date: new Date().toISOString().slice(0, 10),
            amount: 12000,
            type: 'expense',
            category: 'Dining',
            notes: 'Dinner paid via credit card 4111 2222 3333 4444 at Grand Hotel',
            utrNumber: 'UPI/987654321098',
          },
        ],
        budgets: [
          { category: 'Dining', amount: 15000 },
        ],
      };

      const projection = createPrivacySafeSummary(sensitiveRawData);
      const serialized = JSON.stringify(projection);

      // Verify ZERO sensitive personal identifiers or account details are present
      expect(serialized).not.toContain('50100234567890');
      expect(serialized).not.toContain('4111 2222 3333 4444');
      expect(serialized).not.toContain('tx-uuid-1111-2222');
      expect(serialized).not.toContain('acc-secret-999');
      expect(serialized).not.toContain('NEFT-HDFC000123456789');
      expect(serialized).not.toContain('UPI/123456789012');
      expect(serialized).not.toContain('arjun@example.com');
      expect(serialized).not.toContain('9876543210');
      expect(serialized).not.toContain('Grand Hotel');

      // Verify aggregated metrics are present
      expect(projection.summary.totalIncome).toBe(75000);
      expect(projection.summary.totalExpenses).toBe(12000);
      expect(projection.summary.netSavings).toBe(63000);
      expect(projection.summary.savingsRatePercent).toBe(84);

      // Verify budget utilization percentage
      expect(projection.budgetHealth).toHaveLength(1);
      expect(projection.budgetHealth[0].category).toBe('Dining');
      expect(projection.budgetHealth[0].percentageUsed).toBe(80);
      expect(projection.budgetHealth[0].status).toBe('on_track');
    });

    it('scrubPII correctly redacts sensitive patterns in freeform text', () => {
      const text = 'Transfer to acc 123456789012 for rent, contact me at user@finance.com or 555-123-4567. Card used: 4111-2222-3333-4444. Ref: UPI/998877665544';
      const scrubbed = scrubPII(text);

      expect(scrubbed).not.toContain('123456789012');
      expect(scrubbed).not.toContain('user@finance.com');
      expect(scrubbed).not.toContain('555-123-4567');
      expect(scrubbed).not.toContain('4111-2222-3333-4444');
      expect(scrubbed).not.toContain('UPI/998877665544');

      expect(scrubbed).toContain('[ACCOUNT_REDACTED]');
      expect(scrubbed).toContain('[EMAIL_REDACTED]');
      expect(scrubbed).toContain('[PHONE_REDACTED]');
      expect(scrubbed).toContain('[CARD_REDACTED]');
      expect(scrubbed).toContain('[UTR_REDACTED]');
    });
  });

  describe('privacyManager & networkGuard policy enforcement', () => {
    it('defaults to LOCAL_ONLY mode', () => {
      expect(privacyManager.getMode()).toBe(PRIVACY_MODES.LOCAL_ONLY);
      expect(privacyManager.isLocalOnly()).toBe(true);
      expect(privacyManager.isExternalAiAllowed()).toBe(false);
      expect(privacyManager.isExchangeRateAllowed()).toBe(false);
    });

    it('enforces immediate mode changes synchronously and asynchronously in IndexedDB', async () => {
      await privacyManager.setMode(PRIVACY_MODES.EXTERNAL_AI_ENABLED);
      expect(privacyManager.getMode()).toBe(PRIVACY_MODES.EXTERNAL_AI_ENABLED);
      expect(privacyManager.isExternalAiAllowed()).toBe(true);

      // Switch back immediately to LOCAL_ONLY
      await privacyManager.setMode(PRIVACY_MODES.LOCAL_ONLY);
      expect(privacyManager.isLocalOnly()).toBe(true);
      expect(privacyManager.isExternalAiAllowed()).toBe(false);
    });

    it('canMakeRequest correctly allows and denies request categories based on active mode', async () => {
      // 1. LOCAL_ONLY
      await privacyManager.setMode(PRIVACY_MODES.LOCAL_ONLY);
      expect(canMakeRequest('ai_external', 'https://generativelanguage.googleapis.com')).toBe(false);
      expect(canMakeRequest('exchange_rate', 'https://open.er-api.com')).toBe(false);
      expect(canMakeRequest('local_service', 'http://localhost:11434')).toBe(true);

      // 2. PRIVACY_ENHANCED
      await privacyManager.setMode(PRIVACY_MODES.PRIVACY_ENHANCED);
      expect(canMakeRequest('ai_external', 'https://generativelanguage.googleapis.com')).toBe(false);
      expect(canMakeRequest('exchange_rate', 'https://open.er-api.com')).toBe(true);
      expect(canMakeRequest('local_service', 'http://localhost:11434')).toBe(true);

      // 3. EXTERNAL_AI_ENABLED
      await privacyManager.setMode(PRIVACY_MODES.EXTERNAL_AI_ENABLED);
      expect(canMakeRequest('ai_external', 'https://generativelanguage.googleapis.com')).toBe(true);
      expect(canMakeRequest('exchange_rate', 'https://open.er-api.com')).toBe(true);
    });

    it('guardFetch throws PrivacyViolationError when an unauthorized request is attempted', async () => {
      await privacyManager.setMode(PRIVACY_MODES.LOCAL_ONLY);

      await expect(
        guardFetch(
          'https://api.openai.com/v1/chat/completions',
          {},
          { category: 'ai_external', description: 'OpenAI Call' }
        )
      ).rejects.toThrow(PrivacyViolationError);
    });

    it('redactUrl scrubs API key query parameters from URLs', () => {
      const sensitiveUrl = 'https://generativelanguage.googleapis.com/v1beta?key=AIzaSySecret12345&model=gemini';
      const scrubbed = redactUrl(sensitiveUrl);
      expect(scrubbed).not.toContain('AIzaSySecret12345');
      expect(scrubbed).toContain('key=[REDACTED]');
    });
  });
});
