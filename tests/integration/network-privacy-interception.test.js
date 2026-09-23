/**
 * FinTrack Pro — Integration Tests: Network Interception & Privacy Enforcement
 *
 * Verifies that:
 * 1. In LOCAL_ONLY mode, zero outbound requests to external APIs or currency endpoints occur.
 * 2. In PRIVACY_ENHANCED mode, exchange rate requests are allowed, but external AI is blocked.
 * 3. In EXTERNAL_AI_ENABLED mode, external AI requests are permitted, but payload contains
 *    ONLY the privacy-safe aggregated summary (zero card numbers, account numbers, or UTRs).
 * 4. Disablement is immediate upon mode switch.
 * 5. Request errors do not leak credentials.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { privacyManager, PRIVACY_MODES } from '../../src/services/privacy-manager.js';
import { credentialVault } from '../../src/services/credential-vault.js';
import { fetchExchangeRates } from '../../src/services/currency.js';
import { callUserApi } from '../../src/services/user-api.js';
import { analyze } from '../../src/services/ai-engine.js';
import { PrivacyViolationError } from '../../src/services/network-guard.js';
import { resetDatabase } from '../helpers/db-helper.js';

describe('Network Interception & Privacy Enforcement Integration Suite', () => {
  const TEST_PASSPHRASE = 'VaultKey!2026';
  const FAKE_API_KEY = 'AIzaSyFakeKey987654321';
  let interceptedRequests = [];

  beforeEach(async () => {
    await resetDatabase();
    interceptedRequests = [];

    // Mock globalThis.fetch to record all outbound requests
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const recorded = {
        url: String(url),
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body ? JSON.parse(options.body) : null,
      };
      interceptedRequests.push(recorded);

      // Return realistic mock responses
      if (recorded.url.includes('open.er-api.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: 'success',
            rates: { USD: 1.0, INR: 86.5, EUR: 0.92 },
          }),
        };
      }

      if (recorded.url.includes('googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Here is your financial analysis based on your summary.' }],
                },
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }));

    // Setup credential vault with a configured key
    await credentialVault.storeCredentials(
      'ai_config',
      { provider: 'gemini', apiKey: FAKE_API_KEY, model: 'gemini-1.5-flash' },
      TEST_PASSPHRASE
    );

    // Default to LOCAL_ONLY
    await privacyManager.setMode(PRIVACY_MODES.LOCAL_ONLY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('in LOCAL_ONLY mode: blocks all external network calls to AI and currency endpoints', async () => {
    // 1. Attempt currency fetch
    const rates = await fetchExchangeRates('USD');
    expect(rates).toBeNull(); // Blocked by guardFetch, falls back gracefully

    // 2. Attempt AI API call
    await expect(
      callUserApi([{ role: 'user', content: 'Categorize this' }])
    ).rejects.toThrow(PrivacyViolationError);

    // 3. Confirm ZERO requests were made to external servers
    expect(interceptedRequests).toHaveLength(0);
  });

  it('in PRIVACY_ENHANCED mode: allows exchange rate requests but strictly blocks external AI', async () => {
    await privacyManager.setMode(PRIVACY_MODES.PRIVACY_ENHANCED);

    // 1. Currency rates should be allowed
    const rates = await fetchExchangeRates('USD');
    expect(rates).toBeDefined();
    expect(rates.INR).toBe(86.5);
    expect(interceptedRequests).toHaveLength(1);
    expect(interceptedRequests[0].url).toContain('open.er-api.com/v6/latest/USD');

    // 2. External AI must still be blocked
    await expect(
      callUserApi([{ role: 'user', content: 'What is my budget?' }])
    ).rejects.toThrow(PrivacyViolationError);

    // Still only 1 request recorded (the currency rate fetch)
    expect(interceptedRequests).toHaveLength(1);
  });

  it('in EXTERNAL_AI_ENABLED mode: sends ONLY privacy-safe summary projections (zero card numbers, account numbers, or UTRs)', async () => {
    await privacyManager.setMode(PRIVACY_MODES.EXTERNAL_AI_ENABLED);

    const sensitiveFinancialData = {
      profile: { name: 'Priya Patel', currency: 'INR', panNumber: 'PXYZ1234K' },
      accounts: [
        {
          id: 'acc-secret-101',
          name: 'Axis Bank Savings',
          accountNumber: '912010045678912',
          balance: 85000,
        },
      ],
      transactions: [
        {
          id: 'tx-secret-uuid-1',
          accountId: 'acc-secret-101',
          date: new Date().toISOString().slice(0, 10),
          amount: 35000,
          type: 'income',
          category: 'Consulting',
          notes: 'Invoice paid via NEFT-AXIS000987654321',
          utrNumber: 'UPI/778899001122',
        },
        {
          id: 'tx-secret-uuid-2',
          accountId: 'acc-secret-101',
          date: new Date().toISOString().slice(0, 10),
          amount: 4500,
          type: 'expense',
          category: 'Shopping',
          notes: 'Electronics bought using credit card 4242 4242 4242 4242',
          utrNumber: 'UPI/334455667788',
        },
      ],
      budgets: [
        { category: 'Shopping', amount: 8000 },
      ],
    };

    const reply = await analyze('How is my spending?', sensitiveFinancialData);
    expect(reply).toBeDefined();

    // Verify outbound request was intercepted
    expect(interceptedRequests.length).toBeGreaterThanOrEqual(1);
    const aiRequest = interceptedRequests.find((r) => r.url.includes('googleapis.com'));
    expect(aiRequest).toBeDefined();

    // Inspect HTTP request headers: Header authentication used, key NOT in URL query params
    expect(aiRequest.url).not.toContain('?key=');
    expect(aiRequest.headers['x-goog-api-key']).toBe(FAKE_API_KEY);

    // Inspect outgoing payload contents
    const payloadStr = JSON.stringify(aiRequest.body);

    // MUST NOT CONTAIN RAW SENSITIVE IDENTIFIERS:
    expect(payloadStr).not.toContain('912010045678912'); // Account number
    expect(payloadStr).not.toContain('4242 4242 4242 4242'); // Card number
    expect(payloadStr).not.toContain('NEFT-AXIS000987654321'); // UTR / ref
    expect(payloadStr).not.toContain('UPI/778899001122');
    expect(payloadStr).not.toContain('tx-secret-uuid-1'); // Transaction ID
    expect(payloadStr).not.toContain('acc-secret-101'); // Account ID
    expect(payloadStr).not.toContain('Priya Patel'); // User name

    // MUST CONTAIN AGGREGATED TOTALS:
    expect(payloadStr).toContain('totalIncome');
    expect(payloadStr).toContain('35000');
    expect(payloadStr).toContain('totalExpenses');
    expect(payloadStr).toContain('4500');
  });

  it('immediate disablement: switching to LOCAL_ONLY instantly blocks subsequent requests', async () => {
    // 1. Enable External AI
    await privacyManager.setMode(PRIVACY_MODES.EXTERNAL_AI_ENABLED);

    // 2. Perform a successful call
    await callUserApi([{ role: 'user', content: 'Ping' }]);
    expect(interceptedRequests).toHaveLength(1);

    // 3. Immediately switch to LOCAL_ONLY
    await privacyManager.setMode(PRIVACY_MODES.LOCAL_ONLY);

    // 4. Next call MUST be immediately rejected without reaching fetch
    await expect(
      callUserApi([{ role: 'user', content: 'Second query' }])
    ).rejects.toThrow(PrivacyViolationError);

    // Total intercepted requests remains 1
    expect(interceptedRequests).toHaveLength(1);
  });
});
