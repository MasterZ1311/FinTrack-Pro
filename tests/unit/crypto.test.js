/**
 * FinTrack Pro — Unit Tests: Cryptographic Utilities (AES-256-GCM / PBKDF2)
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey, generateSalt } from '../../src/crypto.js';

describe('Cryptography Utilities (src/crypto.js)', () => {
  const passphrase = 'MySuperSecretPassword#2026!';

  describe('generateSalt()', () => {
    it('produces a 16-byte Uint8Array', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('generates distinct salts on consecutive calls', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('deriveKey()', () => {
    it('derives a valid AES-GCM CryptoKey from passphrase and salt', async () => {
      const salt = generateSalt();
      const key = await deriveKey(passphrase, salt);
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(key.extractable).toBe(false);
      expect(key.usages).toEqual(['encrypt', 'decrypt']);
    });
  });

  describe('encrypt() & decrypt() Roundtrip', () => {
    it('successfully encrypts and decrypts normal financial payload string', async () => {
      const payload = JSON.stringify({
        account: 'HDFC Bank',
        balance: 75000,
        transactionsCount: 142,
      });

      const encrypted = await encrypt(payload, passphrase);
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('data');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.data).toBe('string');

      const decrypted = await decrypt(encrypted, passphrase);
      expect(decrypted).toBe(payload);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
    });

    it('correctly handles empty string payload', async () => {
      const encrypted = await encrypt('', passphrase);
      const decrypted = await decrypt(encrypted, passphrase);
      expect(decrypted).toBe('');
    });

    it('handles unicode, emojis, and special international currency symbols', async () => {
      const complexText = '₹ 1,50,000 • € 2.400,50 • 💰 Swiggy Über Zürich • 🚀';
      const encrypted = await encrypt(complexText, passphrase);
      const decrypted = await decrypt(encrypted, passphrase);
      expect(decrypted).toBe(complexText);
    });

    it('fails to decrypt and throws error when given wrong passphrase', async () => {
      const text = 'Sensitive financial records';
      const encrypted = await encrypt(text, passphrase);

      await expect(decrypt(encrypted, 'WrongPassword123')).rejects.toThrow();
    });

    it('fails to decrypt if ciphertext payload is corrupted or tampered', async () => {
      const text = 'Sensitive financial records';
      const encrypted = await encrypt(text, passphrase);

      // Tamper with data payload
      const tampered = {
        ...encrypted,
        data: encrypted.data.slice(0, -4) + 'AAAA',
      };

      await expect(decrypt(tampered, passphrase)).rejects.toThrow();
    });
  });
});
