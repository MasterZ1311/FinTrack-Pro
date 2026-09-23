/**
 * FinTrack Pro — Test Environment Setup Helper
 * Sets up fake-indexeddb, Web Crypto polyfill/globals, and clean resets for Vitest.
 */

import 'fake-indexeddb/auto';
import { beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto API if missing in environment
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}

// In-memory mock localStorage if not provided by jsdom
function createStorageMock() {
  const storage = new Map();
  return {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (i) => Array.from(storage.keys())[i] || null,
  };
}

if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== 'function') {
  globalThis.localStorage = createStorageMock();
}

if (!globalThis.sessionStorage || typeof globalThis.sessionStorage.setItem !== 'function') {
  globalThis.sessionStorage = createStorageMock();
}

beforeEach(() => {
  // Clear storage before each test
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});
