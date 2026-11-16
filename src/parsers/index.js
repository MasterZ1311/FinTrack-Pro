/**
 * FinTrack Pro — Statement Parser Entry Point
 * Detects file format, routes to the appropriate parser, and returns
 * normalized transactions ready for import.
 */

import { parseBankCSV, detectBank } from './csv-parser.js';
import { parseBankPDF } from './pdf-parser.js';
import { parseOFX } from './ofx-parser.js';
import { deduplicateBatch } from './deduplication.js';
import { allBankProfiles, getProfileById, detectProfileFromText } from './bank-profiles/index.js';

// ─── File Format Detection ──────────────────────────────────────────────────

/**
 * Supported file types and their MIME types / extensions.
 */
const FILE_FORMATS = {
  csv: {
    extensions: ['.csv'],
    mimeTypes: ['text/csv', 'application/csv', 'text/comma-separated-values'],
  },
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
  },
  ofx: {
    extensions: ['.ofx', '.qfx'],
    mimeTypes: ['application/x-ofx', 'application/vnd.intu.qfx'],
  },
};

/**
 * Detect file format from filename and/or MIME type.
 * @param {string} fileName
 * @param {string} [mimeType]
 * @returns {'csv' | 'pdf' | 'ofx' | null}
 */
export function detectFileFormat(fileName, mimeType) {
  const lowerName = fileName.toLowerCase();

  for (const [format, config] of Object.entries(FILE_FORMATS)) {
    // Check extension
    if (config.extensions.some(ext => lowerName.endsWith(ext))) {
      return format;
    }
    // Check MIME type
    if (mimeType && config.mimeTypes.includes(mimeType.toLowerCase())) {
      return format;
    }
  }

  // Heuristic: check content starts for OFX
  return null;
}

/**
 * Detect format from file content (for ambiguous cases).
 * @param {string} textContent - First few KB of the file as text
 * @returns {'csv' | 'ofx' | null}
 */
function detectFormatFromContent(textContent) {
  const trimmed = textContent.trim();

  // OFX detection
  if (trimmed.includes('OFXHEADER') || trimmed.includes('<OFX>') || trimmed.includes('<OFX ')) {
    return 'ofx';
  }

  // CSV detection: has commas and newlines
  const lines = trimmed.split('\n');
  if (lines.length > 1 && lines.some(l => l.includes(','))) {
    return 'csv';
  }

  return null;
}

// ─── Main Parser Interface ──────────────────────────────────────────────────

/**
 * Parse a bank statement file into normalized transactions.
 *
 * @param {File} file - The file object from a file input or drag-and-drop
 * @param {object} [options]
 * @param {string} [options.bankProfileId] - Force a specific bank profile
 * @param {boolean} [options.deduplicate=true] - Whether to run deduplication
 * @returns {Promise<ParseResult>}
 *
 * @typedef {object} ParseResult
 * @property {NormalizedTransaction[]} transactions - Parsed transactions
 * @property {NormalizedTransaction[]} duplicates - Duplicate transactions (skipped)
 * @property {object|null} bankProfile - Detected or forced bank profile
 * @property {string} format - Detected file format (csv/pdf/ofx)
 * @property {string[]} errors - Any parsing errors or warnings
 * @property {object} summary - Summary statistics
 */
export async function parseStatement(file, options = {}) {
  const { bankProfileId, deduplicate = true } = options;
  const errors = [];

  // Step 1: Detect file format
  const format = detectFileFormat(file.name, file.type);
  if (!format) {
    // Try reading content for detection
    const textPreview = await readFileAsText(file, 4096);
    const detectedFormat = detectFormatFromContent(textPreview);
    if (!detectedFormat) {
      return {
        transactions: [],
        duplicates: [],
        bankProfile: null,
        format: 'unknown',
        errors: [`Unsupported file format: ${file.name}. Supported formats: CSV, PDF, OFX/QFX`],
        summary: createEmptySummary(),
      };
    }
  }

  const fileFormat = format || 'csv'; // fallback

  // Step 2: Get bank profile if specified
  let bankProfile = null;
  if (bankProfileId) {
    bankProfile = getProfileById(bankProfileId);
    if (!bankProfile) {
      errors.push(`Bank profile "${bankProfileId}" not found, using auto-detection.`);
    }
  }

  // Step 3: Route to appropriate parser
  let parseResult;

  try {
    switch (fileFormat) {
      case 'csv': {
        const textContent = await readFileAsText(file);
        parseResult = await parseBankCSV(textContent, bankProfile);
        break;
      }
      case 'pdf': {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        parseResult = await parseBankPDF(arrayBuffer, bankProfile);
        break;
      }
      case 'ofx': {
        const textContent = await readFileAsText(file);
        const ofxResult = await parseOFX(textContent);
        parseResult = {
          transactions: ofxResult.transactions,
          bankProfile: null,
          errors: ofxResult.errors,
        };
        break;
      }
      default:
        return {
          transactions: [],
          duplicates: [],
          bankProfile: null,
          format: fileFormat,
          errors: [`Parser not implemented for format: ${fileFormat}`],
          summary: createEmptySummary(),
        };
    }
  } catch (err) {
    console.error(`[Parser] Failed to parse ${fileFormat}:`, err);
    return {
      transactions: [],
      duplicates: [],
      bankProfile: null,
      format: fileFormat,
      errors: [`Failed to parse file: ${err.message}`],
      summary: createEmptySummary(),
    };
  }

  // Merge errors
  if (parseResult.errors) {
    errors.push(...parseResult.errors);
  }

  const detectedProfile = parseResult.bankProfile || bankProfile;
  let { transactions } = parseResult;

  // Step 4: Sort transactions by date (newest first)
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  // Step 5: Deduplicate
  let duplicates = [];
  if (deduplicate && transactions.length > 0) {
    const dedupResult = await deduplicateBatch(transactions);
    transactions = dedupResult.unique;
    duplicates = dedupResult.duplicates;
  }

  // Step 6: Generate summary
  const summary = createSummary(transactions, duplicates);

  return {
    transactions,
    duplicates,
    bankProfile: detectedProfile,
    format: fileFormat,
    errors,
    summary,
  };
}

// ─── File Reading Utilities ──────────────────────────────────────────────────

/**
 * Read a File as text.
 * @param {File} file
 * @param {number} [maxBytes] - Optional limit on bytes to read
 * @returns {Promise<string>}
 */
function readFileAsText(file, maxBytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));

    if (maxBytes) {
      const blob = file.slice(0, maxBytes);
      reader.readAsText(blob);
    } else {
      reader.readAsText(file);
    }
  });
}

/**
 * Read a File as an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Summary Generation ─────────────────────────────────────────────────────

/**
 * Create a summary from parsed transactions.
 * @param {object[]} transactions
 * @param {object[]} duplicates
 * @returns {object}
 */
function createSummary(transactions, duplicates) {
  if (transactions.length === 0) {
    return createEmptySummary();
  }

  const dates = transactions.map(t => t.date).sort();
  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

  return {
    totalTransactions: transactions.length,
    duplicatesSkipped: duplicates.length,
    dateRange: {
      from: dates[0],
      to: dates[dates.length - 1],
    },
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    netAmount: Math.round((totalCredit - totalDebit) * 100) / 100,
  };
}

/**
 * Create an empty summary object.
 * @returns {object}
 */
function createEmptySummary() {
  return {
    totalTransactions: 0,
    duplicatesSkipped: 0,
    dateRange: { from: null, to: null },
    totalDebit: 0,
    totalCredit: 0,
    netAmount: 0,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

export {
  allBankProfiles,
  getProfileById,
  detectProfileFromText,
  detectBank,
  parseBankCSV,
  parseBankPDF,
  parseOFX,
  deduplicateBatch,
};

export default {
  parseStatement,
  detectFileFormat,
  allBankProfiles,
  getProfileById,
};
