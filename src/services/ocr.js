import Tesseract from 'tesseract.js';
import { store } from '../store.js';

/**
 * Perform OCR on an image and extract transaction details (amount, date).
 * 
 * @param {string|File|Blob} image - The image to process (File, Blob, or base64)
 * @returns {Promise<{ amount: string, date: string, text: string }>} 
 */
export async function extractTransactionFromImage(image) {
  try {
    store.notify({ type: 'info', message: 'Scanning receipt...', duration: 2000 });
    
    // Run Tesseract
    const result = await Tesseract.recognize(image, 'eng');
    const text = result?.data?.text || '';

    // 1. Extract Amount (Find largest currency-like number)
    // Matches numbers with optional decimals, e.g., 500, 1,200.50, 45.00
    const numberRegex = /[\d,]+\.\d{2}|[\d,]+/g;
    const matches = text.match(numberRegex);
    let amount = '';
    
    if (matches) {
      // Clean and parse numbers
      const numbers = matches.map(m => {
        const cleaned = m.replace(/,/g, '');
        return parseFloat(cleaned);
      }).filter(n => !isNaN(n));
      
      if (numbers.length > 0) {
        // Assume the largest number is the total amount
        const maxNum = Math.max(...numbers);
        amount = maxNum.toString();
      }
    }

    // 2. Extract Date (basic patterns like DD/MM/YYYY, YYYY-MM-DD, or DD-MM-YYYY)
    // Date formats: 12/05/2023, 2023-05-12, 12-05-23
    const dateRegex = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/;
    const dateMatch = text.match(dateRegex);
    let date = '';
    
    if (dateMatch) {
      // Basic normalization to YYYY-MM-DD for input type="date"
      const rawDate = dateMatch[0];
      try {
        let parsedDate;
        if (rawDate.includes('/')) {
          const parts = rawDate.split('/');
          if (parts[0].length === 4) {
             // YYYY/MM/DD
             parsedDate = new Date(parts[0], parts[1]-1, parts[2]);
          } else {
             // DD/MM/YYYY (assuming non-US for now, or use mm/dd)
             // Tesseract might read US dates MM/DD/YYYY, let's just parse it via JS Date if possible
             parsedDate = new Date(parts[2].length === 2 ? `20${parts[2]}` : parts[2], parts[1]-1, parts[0]);
          }
        } else if (rawDate.includes('-')) {
          const parts = rawDate.split('-');
          if (parts[0].length === 4) {
            parsedDate = new Date(parts[0], parts[1]-1, parts[2]);
          } else {
            parsedDate = new Date(parts[2].length === 2 ? `20${parts[2]}` : parts[2], parts[1]-1, parts[0]);
          }
        }
        
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn('[OCR] Date parse failed', e);
      }
    }
    
    if (!amount) store.notify({ type: 'warning', message: 'Could not auto-detect amount.', duration: 3000 });

    return { amount, date, text };
  } catch (error) {
    console.error('[OCR] Error processing image:', error);
    store.notify({ type: 'error', message: 'Failed to scan receipt.', duration: 3000 });
    throw error;
  }
}
