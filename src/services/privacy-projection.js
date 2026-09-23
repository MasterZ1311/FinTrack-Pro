/**
 * FinTrack Pro — Privacy-Safe Financial Summary Projection
 *
 * Prepares aggregated, privacy-preserving financial summaries for AI consumption.
 * Enforces data minimization by stripping:
 * - Bank account numbers and card numbers
 * - UTRs and transaction IDs
 * - Raw notes and personal memo text
 * - Personally Identifying Information (PII)
 *
 * Produces aggregated metrics:
 * - Monthly income, expense, and net savings totals
 * - Category spending breakdowns and percentages
 * - Savings rate percentage
 * - Budget envelope utilization percentages
 */

// Regex patterns for sensitive identifiers
const CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
const UTR_REGEX = /\b(?:UPI|NEFT|IMPS|RTGS)[\/: -]?[A-Za-z0-9]{10,22}\b/gi;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}\b/g;
const ACCOUNT_NUM_REGEX = /\b(?:\d{9,18}|[•*]{4}\s*\d{4})\b/g;

/**
 * Scrub PII and sensitive identifiers from a string.
 * @param {string} text
 * @returns {string}
 */
export function scrubPII(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(CARD_REGEX, '[CARD_REDACTED]')
    .replace(UTR_REGEX, '[UTR_REDACTED]')
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(ACCOUNT_NUM_REGEX, '[ACCOUNT_REDACTED]')
    .replace(PHONE_REGEX, '[PHONE_REDACTED]');
}

/**
 * Create a privacy-safe financial summary projection from raw data.
 * Guarantees zero account numbers, card numbers, UTRs, or raw notes are leaked.
 *
 * @param {object} financialData
 * @param {Array<object>} [financialData.transactions=[]]
 * @param {Array<object>} [financialData.accounts=[]]
 * @param {Array<object>} [financialData.budgets=[]]
 * @param {object} [financialData.profile=null]
 * @returns {object} Privacy-safe projection
 */
export function createPrivacySafeSummary(financialData = {}) {
  const transactions = Array.isArray(financialData.transactions) ? financialData.transactions : [];
  const budgets = Array.isArray(financialData.budgets) ? financialData.budgets : [];
  const profile = financialData.profile || {};

  const now = new Date();
  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  const categoryExpenses = {};

  for (const tx of transactions) {
    if (!tx || typeof tx !== 'object') continue;
    const isCurrentMonth = tx.date && tx.date.startsWith(currentMonthPrefix);

    if (isCurrentMonth) {
      const amount = Number(tx.amount || 0);
      if (tx.type === 'income') {
        monthlyIncome += amount;
      } else if (tx.type === 'expense') {
        monthlyExpenses += amount;
        const cat = tx.category || 'Other';
        categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amount;
      }
    }
  }

  // Calculate savings rate
  const netSavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0
    ? Math.max(0, Math.round((netSavings / monthlyIncome) * 100))
    : 0;

  // Calculate top spending categories with percentages
  const sortedCategories = Object.entries(categoryExpenses)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category: scrubPII(category),
      amount: Math.round(amount),
      percentage: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0,
    }));

  // Budget envelope utilization summary
  const budgetUtilization = budgets.map((b) => {
    const spent = categoryExpenses[b.category] || 0;
    const limit = Number(b.amount || 0);
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    return {
      category: scrubPII(b.category || 'Uncategorized'),
      percentageUsed: pct,
      status: pct >= 100 ? 'exceeded' : pct >= 85 ? 'warning' : 'on_track',
    };
  });

  // Safe non-identifying profile context
  const safeProfile = {
    currency: profile.currency || 'USD',
    profileType: profile.type || 'Individual',
  };

  return {
    period: monthName,
    summary: {
      totalIncome: Math.round(monthlyIncome),
      totalExpenses: Math.round(monthlyExpenses),
      netSavings: Math.round(netSavings),
      savingsRatePercent: savingsRate,
    },
    topExpenseCategories: sortedCategories.slice(0, 5),
    budgetHealth: budgetUtilization,
    profileContext: safeProfile,
    privacyNotice: 'Aggregated projection only. Zero personal identifiers or raw transactions included.',
  };
}

export default {
  createPrivacySafeSummary,
  scrubPII,
};
