/**
 * FinTrack Pro — PDF Statement Parser
 * Extracts transactions from bank PDF statements using PDF.js.
 * Uses coordinate-based text grouping to reconstruct table structure.
 */

import { allBankProfiles } from './bank-profiles/index.js';
import { generateHash } from './deduplication.js';
import { parseDate, parseDateAuto, parseAmount } from './csv-parser.js';

// ─── PDF.js Loader ────────────────────────────────────────────────────────────

let pdfjsLib = null;

/**
 * Load PDF.js library from local bundle (lazy, cached).
 * @returns {Promise<object>} pdfjsLib
 */
async function loadPDFJS() {
  if (pdfjsLib) return pdfjsLib;
  
  // Check if already loaded globally
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    pdfjsLib = window.pdfjsLib;
    return pdfjsLib;
  }
  
  try {
    const module = await import('pdfjs-dist');
    pdfjsLib = module;
    return pdfjsLib;
  } catch (err) {
    console.error('[PDF Parser] Failed to load PDF.js:', err);
    throw new Error('Failed to load PDF processing library.');
  }
}

// ─── Text Extraction ─────────────────────────────────────────────────────────

/**
 * Extract all text items with position data from a PDF.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{ items: Array<{text: string, x: number, y: number, width: number, pageNum: number}>, fullText: string }>}
 */
async function extractTextWithPositions(arrayBuffer) {
  const pdfjs = await loadPDFJS();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const allItems = [];
  let fullText = '';
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue;
      
      const tx = item.transform;
      // transform is [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const x = tx[4];
      // PDF Y is bottom-up; normalize to top-down
      const y = viewport.height - tx[5];
      
      allItems.push({
        text: item.str,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: item.width || 0,
        pageNum,
      });
      
      fullText += item.str + ' ';
    }
  }
  
  return { items: allItems, fullText };
}

// ─── Row Grouping ─────────────────────────────────────────────────────────────

/**
 * Group text items into rows based on Y coordinate proximity.
 * @param {Array} items - Text items with x, y coordinates
 * @param {number} threshold - Y-distance threshold for same row (default 5px)
 * @returns {Array<Array>} Rows of text items, sorted top-to-bottom
 */
function groupIntoRows(items, threshold = 5) {
  if (items.length === 0) return [];
  
  // Sort by Y first, then X
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  
  const rows = [];
  let currentRow = [sorted[0]];
  let currentY = sorted[0].y;
  
  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= threshold) {
      currentRow.push(item);
    } else {
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }
  rows.push(currentRow);
  
  // Sort items within each row by X position
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }
  
  return rows;
}

// ─── Table Detection ─────────────────────────────────────────────────────────

/**
 * Find the header row containing table column keywords.
 * @param {Array<Array>} rows - Grouped text rows
 * @param {string} keyword - Primary keyword to find (e.g., 'Date')
 * @returns {{ rowIndex: number, columnPositions: object } | null}
 */
function findTableHeader(rows, keyword = 'Date') {
  const upperKeyword = keyword.toUpperCase();
  
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].map(item => item.text.trim()).join(' ').toUpperCase();
    
    if (rowText.includes(upperKeyword)) {
      // Check if this looks like a header (has multiple column-like keywords)
      const hasAmountKeyword = /AMOUNT|DEBIT|CREDIT|WITHDRAWAL|DEPOSIT|BALANCE|BETRAG|PAYMENT/i.test(rowText);
      if (hasAmountKeyword || rowText.includes('DESCRIPTION') || rowText.includes('NARRATION') || rowText.includes('PARTICULARS')) {
        // Map column positions from header items
        const columnPositions = {};
        for (const item of rows[i]) {
          const text = item.text.trim().toUpperCase();
          if (/DATE/.test(text)) columnPositions.date = item.x;
          if (/DESC|NARR|PARTIC|MEMO|REFERENCE|VERWENDUNG|LIBELL/.test(text)) columnPositions.description = item.x;
          if (/DEBIT|WITHDRAWAL|PAYMENT|D[EÉ]BIT/.test(text)) columnPositions.debit = item.x;
          if (/CREDIT|DEPOSIT|LODGEMENT|CR[EÉ]DIT/.test(text)) columnPositions.credit = item.x;
          if (/AMOUNT|BETRAG/.test(text)) columnPositions.amount = item.x;
          if (/BALANCE|BAL|SOLDE/.test(text)) columnPositions.balance = item.x;
          if (/REF|CHQ|CHEQUE|TYPE/.test(text)) columnPositions.reference = item.x;
        }
        return { rowIndex: i, columnPositions };
      }
    }
  }
  return null;
}

/**
 * Classify a text item into a column based on its X position relative to known columns.
 * @param {number} x - X position of the text item
 * @param {object} columnPositions - Known column X positions
 * @returns {string|null} Column name
 */
function classifyColumn(x, columnPositions) {
  let closestCol = null;
  let closestDist = Infinity;
  
  for (const [col, colX] of Object.entries(columnPositions)) {
    const dist = Math.abs(x - colX);
    if (dist < closestDist && dist < 80) { // within 80px
      closestDist = dist;
      closestCol = col;
    }
  }
  
  return closestCol;
}

// ─── Bank Detection from PDF ─────────────────────────────────────────────────

/**
 * Detect bank from PDF text content.
 * @param {string} fullText
 * @returns {{ profile: object, confidence: number } | null}
 */
function detectBankFromPDF(fullText) {
  const upper = fullText.toUpperCase();
  let bestMatch = null;
  let bestScore = 0;
  
  for (const profile of allBankProfiles) {
    let score = 0;
    for (const sig of profile.signatures) {
      if (upper.includes(sig.toUpperCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { profile, confidence: Math.min(0.9, 0.5 + score * 0.2) };
    }
  }
  
  return bestScore > 0 ? bestMatch : null;
}

// ─── Regex Fallback ──────────────────────────────────────────────────────────

/**
 * Fallback: extract transactions using regex patterns when table structure detection fails.
 * @param {string} fullText
 * @param {object} [profile]
 * @returns {Promise<object[]>}
 */
async function regexFallback(fullText, profile) {
  const transactions = [];
  // Indian date: DD/MM/YYYY or DD-MM-YYYY
  // US date: MM/DD/YYYY
  // ISO: YYYY-MM-DD
  const datePattern = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/g;
  const amountPattern = /([\d,]+\.\d{2})/g;
  
  const lines = fullText.split(/\n/);
  
  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;
    
    const amounts = [];
    let m;
    const amtRegex = /([\d,]+\.\d{2})/g;
    while ((m = amtRegex.exec(line)) !== null) {
      amounts.push(m[1]);
    }
    
    if (amounts.length === 0) continue;
    
    const dateStr = dateMatch[0];
    const date = profile ? parseDate(dateStr, profile.dateFormat) : parseDateAuto(dateStr);
    if (!date) continue;
    
    // Try to extract description (text between date and first amount)
    const dateEndIdx = line.indexOf(dateStr) + dateStr.length;
    const firstAmtIdx = line.indexOf(amounts[0]);
    const description = firstAmtIdx > dateEndIdx 
      ? line.substring(dateEndIdx, firstAmtIdx).trim()
      : 'Unknown';
    
    let debit = null;
    let credit = null;
    let balance = null;
    
    if (amounts.length >= 3) {
      // Likely: debit, credit, balance
      debit = parseAmount(amounts[0], profile?.numberFormat) || null;
      credit = parseAmount(amounts[1], profile?.numberFormat) || null;
      balance = parseAmount(amounts[2], profile?.numberFormat);
      if (debit === 0) debit = null;
      if (credit === 0) credit = null;
    } else if (amounts.length === 2) {
      // Could be amount + balance
      const amt = parseAmount(amounts[0], profile?.numberFormat);
      balance = parseAmount(amounts[1], profile?.numberFormat);
      if (amt && amt < 0) {
        debit = Math.abs(amt);
      } else if (amt) {
        credit = Math.abs(amt);
      }
    } else {
      const amt = parseAmount(amounts[0], profile?.numberFormat);
      if (amt && amt < 0) {
        debit = Math.abs(amt);
      } else if (amt) {
        // Can't tell if debit or credit from just one amount
        debit = Math.abs(amt);
      }
    }
    
    const amount = debit || credit || 0;
    const hash = await generateHash(date, description, amount);
    
    transactions.push({
      date,
      description: description.replace(/\s+/g, ' ').trim() || 'Unknown',
      debit,
      credit,
      balance,
      reference: '',
      rawRow: line.trim(),
      hash,
      confidence: 0.4,
    });
  }
  
  return transactions;
}

// ─── Main PDF Parser ─────────────────────────────────────────────────────────

/**
 * Parse a bank PDF statement into normalized transactions.
 * @param {ArrayBuffer} arrayBuffer - PDF file content
 * @param {object} [bankProfile] - Bank profile (auto-detected if not provided)
 * @returns {Promise<{ transactions: object[], bankProfile: object|null, errors: string[] }>}
 */
export async function parseBankPDF(arrayBuffer, bankProfile = null) {
  const errors = [];
  
  try {
    // Step 1: Extract text with positions
    const { items, fullText } = await extractTextWithPositions(arrayBuffer);
    
    if (items.length === 0) {
      return { transactions: [], bankProfile: null, errors: ['PDF contains no extractable text. It may be a scanned document.'] };
    }
    
    // Step 2: Detect bank
    let profile = bankProfile;
    if (!profile) {
      const detection = detectBankFromPDF(fullText);
      if (detection) profile = detection.profile;
    }
    
    // Step 3: Group text into rows
    const rows = groupIntoRows(items);
    
    // Step 4: Find table header
    const tableKeyword = profile?.pdf?.tableStartKeyword || profile?.headerRowKeyword || 'Date';
    const header = findTableHeader(rows, tableKeyword);
    
    if (!header) {
      // Fallback to regex
      console.warn('[PDF Parser] Could not detect table structure, falling back to regex.');
      const fallbackTxns = await regexFallback(fullText, profile);
      if (fallbackTxns.length === 0) {
        errors.push('Could not detect table structure in PDF. Try CSV format instead.');
      }
      return { transactions: fallbackTxns, bankProfile: profile, errors };
    }
    
    // Step 5: Parse data rows after header
    const dateFormat = profile?.dateFormat || null;
    const numberFormat = profile?.numberFormat || 'standard';
    const transactions = [];
    let lastDescription = '';
    
    for (let i = header.rowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Classify each item into columns
      const classified = {};
      for (const item of row) {
        const col = classifyColumn(item.x, header.columnPositions);
        if (col) {
          classified[col] = (classified[col] || '') + ' ' + item.text;
        }
      }
      
      // Clean up
      for (const key of Object.keys(classified)) {
        classified[key] = classified[key].trim();
      }
      
      const rawDateStr = classified.date?.trim();
      
      // Handle multi-line descriptions (rows without a date)
      if (!rawDateStr && classified.description && transactions.length > 0) {
        const lastTx = transactions[transactions.length - 1];
        lastTx.description += ' ' + classified.description.trim();
        continue;
      }
      
      if (!rawDateStr) continue;
      
      const date = dateFormat ? parseDate(rawDateStr, dateFormat) : parseDateAuto(rawDateStr);
      if (!date) continue;
      
      const description = classified.description?.trim() || '';
      let debit = null;
      let credit = null;
      let balance = null;
      
      if (classified.debit) {
        const d = parseAmount(classified.debit, numberFormat);
        if (d !== null && d !== 0) debit = Math.abs(d);
      }
      if (classified.credit) {
        const c = parseAmount(classified.credit, numberFormat);
        if (c !== null && c !== 0) credit = Math.abs(c);
      }
      if (classified.amount) {
        const amt = parseAmount(classified.amount, numberFormat);
        if (amt !== null) {
          if (amt < 0) debit = Math.abs(amt);
          else credit = Math.abs(amt);
        }
      }
      if (classified.balance) {
        balance = parseAmount(classified.balance, numberFormat);
      }
      
      const amount = debit || credit || 0;
      const rawRow = row.map(item => item.text).join(' ');
      const hash = await generateHash(date, description, amount);
      
      transactions.push({
        date,
        description: description || 'Unknown',
        debit,
        credit,
        balance,
        reference: classified.reference?.trim() || '',
        rawRow,
        hash,
        confidence: profile ? 0.75 : 0.5,
      });
    }
    
    if (transactions.length === 0) {
      // Try regex fallback
      const fallbackTxns = await regexFallback(fullText, profile);
      return { transactions: fallbackTxns, bankProfile: profile, errors };
    }
    
    return { transactions, bankProfile: profile, errors };
    
  } catch (err) {
    console.error('[PDF Parser] Error:', err);
    errors.push(`PDF parsing failed: ${err.message}`);
    return { transactions: [], bankProfile: null, errors };
  }
}

export default { parseBankPDF };
