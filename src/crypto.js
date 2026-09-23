/**
 * FinTrack Pro — AES-256 Encryption via Web Crypto API
 * Provides encrypt/decrypt utilities for sensitive data at rest.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM

export class CryptoError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class InvalidPassphraseError extends CryptoError {
  constructor(message = 'Decryption failed: invalid passphrase or corrupted data.') {
    super(message);
    this.name = 'InvalidPassphraseError';
  }
}

export class CorruptedCiphertextError extends CryptoError {
  constructor(message = 'Ciphertext payload is invalid or corrupted.') {
    super(message);
    this.name = 'CorruptedCiphertextError';
  }
}

// ─── Key Management ───────────────────────────────────────────────────────────

/**
 * Derive a CryptoKey from a user-supplied passphrase using PBKDF2.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(passphrase, salt) {
  if (!passphrase || typeof passphrase !== 'string') {
    throw new CryptoError('Passphrase must be a non-empty string.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random salt for key derivation.
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a JSON-serializable object containing iv, salt, and ciphertext.
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {Promise<{ iv: string, salt: string, data: string }>}
 */
export async function encrypt(plaintext, passphrase) {
  if (plaintext == null || typeof plaintext !== 'string') {
    throw new CryptoError('Plaintext must be a string.');
  }
  if (!passphrase || typeof passphrase !== 'string') {
    throw new CryptoError('Passphrase must be a non-empty string.');
  }

  const encoder = new TextEncoder();
  const salt = generateSalt();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    data: bufferToBase64(new Uint8Array(encrypted)),
  };
}

/**
 * Decrypt a ciphertext object back to a plaintext string.
 * @param {{ iv: string, salt: string, data: string }} encryptedObj
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
export async function decrypt(encryptedObj, passphrase) {
  if (!encryptedObj || typeof encryptedObj !== 'object') {
    throw new CorruptedCiphertextError('Invalid encrypted payload object.');
  }
  if (!encryptedObj.iv || !encryptedObj.salt || !encryptedObj.data) {
    throw new CorruptedCiphertextError('Encrypted payload is missing required iv, salt, or data.');
  }
  if (!passphrase || typeof passphrase !== 'string') {
    throw new InvalidPassphraseError('Passphrase is required for decryption.');
  }

  let iv, salt, data;
  try {
    iv = base64ToBuffer(encryptedObj.iv);
    salt = base64ToBuffer(encryptedObj.salt);
    data = base64ToBuffer(encryptedObj.data);
  } catch (err) {
    throw new CorruptedCiphertextError(`Base64 decoding failed: ${err.message}`);
  }

  if (iv.length !== IV_LENGTH || salt.length < 16 || data.length === 0) {
    throw new CorruptedCiphertextError('Invalid cryptographic parameter lengths in payload.');
  }

  let key;
  try {
    key = await deriveKey(passphrase, salt);
  } catch (err) {
    throw new CryptoError(`Key derivation failed: ${err.message}`);
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new InvalidPassphraseError('Decryption authentication failed: wrong passphrase or modified ciphertext.');
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Convert an ArrayBuffer/Uint8Array to a base64 string.
 * @param {Uint8Array} buffer
 * @returns {string}
 */
export function bufferToBase64(buffer) {
  let binary = '';
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return (typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : Buffer.from(binary, 'binary').toString('base64'));
}

/**
 * Convert a base64 string back to a Uint8Array.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBuffer(base64) {
  const binary = (typeof globalThis.atob === 'function' ? globalThis.atob(base64) : Buffer.from(base64, 'base64').toString('binary'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export default {
  encrypt,
  decrypt,
  deriveKey,
  generateSalt,
  bufferToBase64,
  base64ToBuffer,
  CryptoError,
  InvalidPassphraseError,
  CorruptedCiphertextError,
};
