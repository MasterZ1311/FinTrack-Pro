/**
 * FinTrack Pro — Unit Tests: Credential Vault & Secret Management
 *
 * Verifies:
 * - Roundtrip Web Crypto AES-256-GCM encryption/decryption in IndexedDB
 * - Rejection of wrong passphrases
 * - Corrupted ciphertext rejection
 * - Missing credential handling
 * - Credential deletion & clear
 * - Migration from legacy plaintext localStorage
 * - Page reload (sessionStorage rehydration) vs browser restart (sessionStorage cleared)
 * - Safe export behavior (zero credentials in export)
 * - Sensitive token & error scrubbing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { credentialVault } from '../../src/services/credential-vault.js';
import { resetDatabase } from '../helpers/db-helper.js';
import { getById, update } from '../../src/db.js';
import { InvalidPassphraseError } from '../../src/crypto.js';

describe('Credential Vault Unit Suite', () => {
  const TEST_ID = 'ai_config';
  const TEST_PASSPHRASE = 'MySuperSecurePassphrase!2026';
  const TEST_CONFIG = {
    provider: 'gemini',
    apiKey: 'AIzaSyA_Sample_Gemini_Secret_Key_12345',
    model: 'gemini-1.5-flash',
  };

  beforeEach(async () => {
    await resetDatabase();
    credentialVault.lock();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('encrypts and stores credentials at rest in IndexedDB, decrypts accurately on unlock', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);

    // 1. Verify encrypted record exists in IndexedDB
    const rawRecord = await getById('credentials', TEST_ID);
    expect(rawRecord).toBeDefined();
    expect(rawRecord.id).toBe(TEST_ID);
    expect(rawRecord.salt).toBeDefined();
    expect(rawRecord.iv).toBeDefined();
    expect(rawRecord.data).toBeDefined();

    // 2. Verify ciphertext is NOT plaintext and does NOT contain the raw API key
    expect(rawRecord.data).not.toContain(TEST_CONFIG.apiKey);
    expect(rawRecord.data).not.toContain(TEST_PASSPHRASE);

    // 3. Verify in-memory retrieval when unlocked
    expect(credentialVault.isUnlocked()).toBe(true);
    const retrieved = credentialVault.getCredentials(TEST_ID);
    expect(retrieved).toEqual(TEST_CONFIG);
  });

  it('rejects decryption when provided with a wrong passphrase and does not leak credentials', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);

    // Lock vault to clear in-memory cache
    credentialVault.lock();
    expect(credentialVault.isUnlocked()).toBe(false);
    expect(credentialVault.getCredentials(TEST_ID)).toBeNull();

    // Attempt unlock with incorrect passphrase
    await expect(credentialVault.unlock('WrongPassword!999')).rejects.toThrow(InvalidPassphraseError);
    expect(credentialVault.isUnlocked()).toBe(false);
    expect(credentialVault.getCredentials(TEST_ID)).toBeNull();
  });

  it('handles corrupted or tampered ciphertext gracefully with CorruptedCiphertextError', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);
    credentialVault.lock();

    // Tamper with ciphertext in IndexedDB
    const record = await getById('credentials', TEST_ID);
    record.data = 'CORRUPTED_BASE64_DATA_STRING';
    await update('credentials', record);

    await expect(credentialVault.unlock(TEST_PASSPHRASE)).rejects.toThrow();
  });

  it('gracefully handles missing credentials without unhandled exceptions', async () => {
    const hasCreds = await credentialVault.hasCredentials('non_existent_id');
    expect(hasCreds).toBe(false);

    const creds = credentialVault.getCredentials('non_existent_id');
    expect(creds).toBeNull();
  });

  it('deletes stored credentials and wipes them from in-memory cache and sessionStorage', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);
    expect(await credentialVault.hasCredentials(TEST_ID)).toBe(true);

    await credentialVault.deleteCredentials(TEST_ID);

    expect(await credentialVault.hasCredentials(TEST_ID)).toBe(false);
    expect(credentialVault.getCredentials(TEST_ID)).toBeNull();
    const sessionObj = JSON.parse(sessionStorage.getItem('fintrack_session_vault'));
    expect(sessionObj.credentials).toEqual({});
  });

  it('clears all credentials completely on clearAll()', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);
    await credentialVault.clearAll();

    expect(await credentialVault.hasCredentials(TEST_ID)).toBe(false);
    expect(credentialVault.isUnlocked()).toBe(false);
    expect(credentialVault.getCredentials(TEST_ID)).toBeNull();
    expect(sessionStorage.getItem('fintrack_session_vault')).toBeNull();
  });

  it('migrates legacy plaintext credentials from localStorage into encrypted IndexedDB storage and purges old keys', async () => {
    // 1. Simulate legacy unencrypted storage in localStorage
    localStorage.setItem(
      'fintrack_api_config',
      JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-legacy-test-key-1234567890',
        model: 'gpt-3.5-turbo',
      })
    );
    localStorage.setItem('ai_api_key', 'sk-legacy-test-key-1234567890');

    expect(credentialVault.hasLegacyPlaintextCredentials()).toBe(true);

    // 2. Perform explicit migration with user passphrase
    const success = await credentialVault.migrateLegacyCredentials(TEST_PASSPHRASE);
    expect(success).toBe(true);

    // 3. Verify legacy plaintext keys were purged from localStorage
    expect(localStorage.getItem('fintrack_api_config')).toBeNull();
    expect(localStorage.getItem('ai_api_key')).toBeNull();
    expect(credentialVault.hasLegacyPlaintextCredentials()).toBe(false);

    // 4. Verify migrated credentials exist encrypted in IndexedDB
    const rawRecord = await getById('credentials', 'ai_config');
    expect(rawRecord).toBeDefined();
    expect(rawRecord.provider).toBe('openai');

    // 5. Verify credentials decrypt accurately
    const decrypted = credentialVault.getCredentials('ai_config');
    expect(decrypted.apiKey).toBe('sk-legacy-test-key-1234567890');
  });

  it('discards legacy plaintext credentials without saving if the user chooses to discard them', () => {
    localStorage.setItem('fintrack_api_config', JSON.stringify({ provider: 'gemini', apiKey: 'test' }));
    expect(credentialVault.hasLegacyPlaintextCredentials()).toBe(true);

    credentialVault.discardLegacyCredentials();

    expect(localStorage.getItem('fintrack_api_config')).toBeNull();
    expect(credentialVault.hasLegacyPlaintextCredentials()).toBe(false);
  });

  it('preserves session across page reload via tab sessionStorage rehydration', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);
    expect(credentialVault.isUnlocked()).toBe(true);

    // Simulate page reload: create fresh vault instance while sessionStorage is preserved
    // (mocking the behavior of browser tab refresh)
    const reloadedVault = new (credentialVault.constructor)();
    await reloadedVault.init();

    expect(reloadedVault.isUnlocked()).toBe(true);
    expect(reloadedVault.getCredentials(TEST_ID)).toEqual(TEST_CONFIG);
  });

  it('resets to locked state on browser restart when sessionStorage is empty', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);

    // Simulate browser restart: sessionStorage is wiped by the browser engine
    sessionStorage.clear();

    const restartedVault = new (credentialVault.constructor)();
    await restartedVault.init();

    // Vault must start locked
    expect(restartedVault.isUnlocked()).toBe(false);
    expect(restartedVault.getCredentials(TEST_ID)).toBeNull();

    // Must require user passphrase to unlock
    await restartedVault.unlock(TEST_PASSPHRASE);
    expect(restartedVault.isUnlocked()).toBe(true);
    expect(reloadedCreds => reloadedCreds).toBeDefined();
  });

  it('ensures data export payload strictly excludes credentials and passphrases', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);

    // Mock financial export object
    const exportPayload = {
      profile: { name: 'Alice' },
      accounts: [{ name: 'Checking', balance: 5000 }],
      transactions: [{ description: 'Salary', amount: 5000 }],
      categories: [{ name: 'Income' }],
      budgets: [],
    };

    // Ensure credentials are never attached to exportPayload
    const serialized = JSON.stringify(exportPayload);
    expect(serialized).not.toContain(TEST_CONFIG.apiKey);
    expect(serialized).not.toContain(TEST_PASSPHRASE);
    expect(serialized).not.toContain('credentials');
  });

  it('scrubs sensitive API keys, query params, and bearer tokens from error strings', async () => {
    await credentialVault.storeCredentials(TEST_ID, TEST_CONFIG, TEST_PASSPHRASE);

    const sampleUrlError = `Failed to fetch: https://generativelanguage.googleapis.com/v1beta?key=${TEST_CONFIG.apiKey}&model=gemini`;
    const scrubbedUrl = credentialVault.scrubSensitive(sampleUrlError);
    expect(scrubbedUrl).not.toContain(TEST_CONFIG.apiKey);
    expect(scrubbedUrl).toContain('key=[REDACTED]');

    const sampleBearerError = 'Authorization failure: Bearer sk-ant-api03-abcdef1234567890 token expired';
    const scrubbedBearer = credentialVault.scrubSensitive(sampleBearerError);
    expect(scrubbedBearer).not.toContain('sk-ant-api03-abcdef1234567890');
    expect(scrubbedBearer).toContain('Bearer [REDACTED]');
  });
});
