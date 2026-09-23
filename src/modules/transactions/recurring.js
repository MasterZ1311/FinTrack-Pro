/**
 * FinTrack Pro — Recurring Transactions Engine
 * Generates future dates, checks for missed instances, and surfaces upcoming events.
 */

import { getAll, add as dbAdd, update as dbUpdate } from '../../db.js';
import { store } from '../../store.js';
import { createTransactionDefaults } from './schema.js';

// ─── Date Arithmetic Helpers ──────────────────────────────────────────────────

/**
 * Add a recurring interval to a date.
 * @param {Date} date
 * @param {import('./schema.js').RecurringRule} rule
 * @returns {Date}
 */
function addInterval(date, rule) {
  const d = new Date(date);
  const { frequency, interval = 1, dayOfMonth } = rule;

  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7 * interval);
      break;
    case 'monthly': {
      const targetDay = dayOfMonth || d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + interval);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, lastDay));
      break;
    }
    case 'quarterly': {
      const targetDay = dayOfMonth || d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 3 * interval);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, lastDay));
      break;
    }
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval);
      break;
    case 'custom':
      // custom uses interval as number of days
      d.setDate(d.getDate() + interval);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Stringify a Date to YYYY-MM-DD.
 * @param {Date} d
 * @returns {string}
 */
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate an array of future occurrence dates for a recurring rule.
 * Respects endDate and maxOccurrences.
 *
 * @param {import('./schema.js').RecurringRule} recurringRule
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {number} [count=12] - Maximum occurrences to generate
 * @returns {string[]} Array of ISO date strings
 *
 * @example
 * generateRecurringInstances({ frequency: 'monthly', interval: 1 }, '2024-01-15', 6)
 * // → ['2024-02-15', '2024-03-15', ...]
 */
export function generateRecurringInstances(recurringRule, startDate, count = 12) {
  if (!recurringRule) return [];

  const { endDate, maxOccurrences } = recurringRule;
  const limit = maxOccurrences ? Math.min(count, maxOccurrences) : count;
  const cutoff = endDate ? new Date(endDate) : null;

  const dates = [];
  let current = new Date(startDate);

  // Start from the NEXT occurrence (after startDate)
  current = addInterval(current, recurringRule);

  while (dates.length < limit) {
    if (cutoff && current > cutoff) break;
    dates.push(toDateStr(current));
    current = addInterval(current, recurringRule);
  }

  return dates;
}

/**
 * Check for recurring transactions that were missed while the app was closed,
 * and create them as auto-generated entries.
 *
 * Should be called once on app load (from main.js bootstrap).
 *
 * @returns {Promise<number>} Number of auto-generated transactions created
 */
export async function processRecurring() {
  const today = toDateStr(new Date());
  let created = 0;

  try {
    const allTransactions = await getAll('transactions');

    // Find all "parent" recurring transactions (the original, not auto-generated)
    const recurringParents = allTransactions.filter(
      (tx) => tx.isRecurring && tx.recurringRule && !tx.recurringId
    );

    for (const parent of recurringParents) {
      const { recurringRule, date: startDate } = parent;
      if (!recurringRule) continue;

      // Find the latest occurrence (including auto-generated siblings)
      const siblings = allTransactions.filter(
        (tx) => tx.recurringId === parent.id
      );
      const latestDate = siblings.length > 0
        ? siblings.reduce((max, tx) => (tx.date > max ? tx.date : max), startDate)
        : startDate;

      // Generate any missed occurrences between latestDate and today
      let current = new Date(latestDate);
      const endDate = recurringRule.endDate ? new Date(recurringRule.endDate) : null;

      let safetyCounter = 0; // guard against infinite loops
      while (safetyCounter < 366) {
        safetyCounter++;
        current = addInterval(current, recurringRule);
        const currentStr = toDateStr(current);

        if (currentStr > today) break;
        if (endDate && current > endDate) break;

        // Check if this date already has an auto-generated entry
        const alreadyExists = allTransactions.some(
          (tx) => tx.recurringId === parent.id && tx.date === currentStr
        );
        if (alreadyExists) continue;

        // Create auto-generated transaction
        const newTx = createTransactionDefaults({
          ...parent,
          id: crypto.randomUUID(),
          date: currentStr,
          recurringId: parent.id,
          isAutoGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await dbAdd('transactions', newTx);
        created++;
      }
    }

    if (created > 0) {
      // Refresh store with updated transactions
      const refreshed = await getAll('transactions');
      store.setState('transactions', refreshed);
      store.notify({
        type: 'info',
        message: `${created} recurring transaction${created > 1 ? 's' : ''} auto-created`,
        duration: 5000,
      });
      console.log(`[Recurring] Auto-created ${created} missed transaction(s).`);
    }
  } catch (err) {
    console.error('[Recurring] processRecurring failed:', err);
  }

  return created;
}

/**
 * Get upcoming scheduled recurring transactions within the next N days.
 *
 * @param {number} [days=30] - Look-ahead window in days
 * @returns {Promise<Array<{transaction: object, nextDate: string}>>}
 *
 * @example
 * const upcoming = await getUpcomingRecurring(7);
 * // → [{ transaction: {...}, nextDate: '2024-02-05' }, ...]
 */
export async function getUpcomingRecurring(days = 30) {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);
  const todayStr = toDateStr(today);
  const cutoffStr = toDateStr(cutoff);

  try {
    const allTransactions = await getAll('transactions');

    // Recurring parents only
    const parents = allTransactions.filter(
      (tx) => tx.isRecurring && tx.recurringRule && !tx.recurringId
    );

    const upcoming = [];

    for (const parent of parents) {
      if (!parent.recurringRule) continue;

      // Find the latest sibling date
      const siblings = allTransactions.filter((tx) => tx.recurringId === parent.id);
      const latestDate = siblings.length > 0
        ? siblings.reduce((max, tx) => (tx.date > max ? tx.date : max), parent.date)
        : parent.date;

      // Generate next occurrences within window
      let current = new Date(latestDate);
      for (let i = 0; i < 60; i++) {
        current = addInterval(current, parent.recurringRule);
        const dateStr = toDateStr(current);
        if (dateStr > cutoffStr) break;
        if (dateStr >= todayStr) {
          upcoming.push({ transaction: parent, nextDate: dateStr });
        }
      }
    }

    // Sort by nextDate ascending
    upcoming.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    return upcoming;
  } catch (err) {
    console.error('[Recurring] getUpcomingRecurring failed:', err);
    return [];
  }
}

/**
 * Cancel a recurring series by clearing the recurringRule on the parent.
 * @param {string} parentId - ID of the original recurring transaction
 * @returns {Promise<void>}
 */
export async function cancelRecurringSeries(parentId) {
  try {
    const allTx = await getAll('transactions');
    const parent = allTx.find((tx) => tx.id === parentId);
    if (!parent) return;

    const updated = {
      ...parent,
      isRecurring: false,
      recurringRule: null,
      updatedAt: new Date().toISOString(),
    };
    await dbUpdate('transactions', updated);

    const refreshed = await getAll('transactions');
    store.setState('transactions', refreshed);
  } catch (err) {
    console.error('[Recurring] cancelRecurringSeries failed:', err);
  }
}

export default {
  generateRecurringInstances,
  processRecurring,
  getUpcomingRecurring,
  cancelRecurringSeries,
};
