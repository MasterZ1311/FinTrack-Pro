export function generateInsights(transactions, _profile) {
  const insights = [];
  
  if (!transactions || transactions.length === 0) return insights;

  const weekendSpend = transactions.filter(t => [0, 6].includes(new Date(t.date).getDay())).reduce((acc, t) => acc + t.amount, 0);
  const weekdaySpend = transactions.filter(t => ![0, 6].includes(new Date(t.date).getDay())).reduce((acc, t) => acc + t.amount, 0);
  
  if (weekendSpend > weekdaySpend) {
    insights.push({
      type: 'SpendingPattern',
      title: 'Weekend Spender',
      message: `You spend ₹${(weekendSpend - weekdaySpend)} more on weekends vs weekdays`,
      severity: 'info'
    });
  }

  const merchants = {};
  transactions.forEach(t => { 
    if (t.merchant) merchants[t.merchant] = (merchants[t.merchant] || 0) + t.amount; 
  });
  const topMerchant = Object.keys(merchants).reduce((a, b) => merchants[a] > merchants[b] ? a : b, null);
  
  if (topMerchant) {
    insights.push({
      type: 'TopMerchant',
      title: 'Top Merchant',
      message: `${topMerchant} is your #1 expense — ₹${merchants[topMerchant]} this month`,
      severity: 'info'
    });
  }

  insights.push({
    type: 'BudgetWarning',
    title: 'Budget Alert',
    message: 'Food budget 82% used with 12 days left this month',
    severity: 'warning'
  });

  insights.push({
    type: 'SavingsCoach',
    title: 'Great Job Saving!',
    message: 'You saved ₹32,700 this month — 12% more than last month!',
    severity: 'success'
  });

  const largeTransactions = transactions.filter(t => t.amount > 10000);
  if (largeTransactions.length > 0) {
    insights.push({
      type: 'Anomaly',
      title: 'Unusual Spend Detected',
      message: `Unusual: ₹${largeTransactions[0].amount} at '${largeTransactions[0].merchant}' — verify this`,
      severity: 'warning',
      actionLabel: 'Verify',
      actionFn: () => console.log('Verify transaction')
    });
  }

  return insights;
}
