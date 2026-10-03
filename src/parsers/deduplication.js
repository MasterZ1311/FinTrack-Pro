/**
 * FinTrack Pro — Transaction Deduplication
 * SHA-256 based hashing for detecting duplicate transactions.
 */

import { getAll } from '../db.js';

/**
 * Generate a SHA-256 hash (first 16 hex chars) from transaction data.
 * Uses the Web Crypto API.
 * @param {string} date - YYYY-MM-DD format
 * @param {string} description
 * @param {number} amount - absolute amount value
 * @returns {Promise<string>} First 16 chars of the SHA-256 hex digest
 */
export async function generateHash(date, description, amount, type = null) {
  let typeStr = '';
  if (type) {
    typeStr = `|${String(type).trim().toLowerCase()}`;
  }
  const input = `${date}|${description.trim().toLowerCase()}|${Math.abs(amount).toFixed(2)}${typeStr}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16);
}

/**
 * Check if a transaction hash already exists in a set of known hashes.
 * @param {string} hash
 * @param {string[]} existingHashes
 * @returns {boolean}
 */
export function isDuplicate(hash, existingHashes) {
  return existingHashes.includes(hash);
}

/**
 * Retrieve all existing transaction hashes from IndexedDB.
 * Looks for `bankRef` or `hash` field on each transaction.
 * @returns {Promise<string[]>}
 */
export async function getExistingHashes() {
  try {
    const transactions = await getAll('transactions');
    const hashes = [];
    for (const tx of transactions) {
      if (tx.bankRef) hashes.push(tx.bankRef);
      if (tx.hash) hashes.push(tx.hash);
    }
    return hashes;
  } catch (err) {
    console.error('[Dedup] Failed to retrieve existing hashes:', err);
    return [];
  }
}

/**
 * Deduplicate a batch of parsed transactions against existing DB records.
 * @param {Array<{hash: string}>} transactions - Parsed transactions with hashes
 * @param {string[]} [knownHashes] - Optional pre-fetched hashes
 * @returns {Promise<{unique: object[], duplicates: object[]}>}
 */
export async function deduplicateBatch(transactions, knownHashes) {
  const existing = knownHashes || await getExistingHashes();
  const existingSet = new Set(existing);
  const seenInBatch = new Set();
  
  const unique = [];
  const duplicates = [];
  
  for (const tx of transactions) {
    if (existingSet.has(tx.hash) || seenInBatch.has(tx.hash)) {
      duplicates.push(tx);
    } else {
      unique.push(tx);
      seenInBatch.add(tx.hash);
    }
  }
  
  return { unique, duplicates };
}

export default { generateHash, isDuplicate, getExistingHashes, deduplicateBatch };
