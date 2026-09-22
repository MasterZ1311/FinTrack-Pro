/**
 * FinTrack Pro — Test Fixtures: Transactions & Statements
 * Includes realistic datasets for normal, Indian bank, UPI, NEFT/IMPS,
 * multi-currency, transfers, splits, recurring, malformed, and malicious inputs.
 */

export const NORMAL_TRANSACTIONS = [
  {
    id: 'tx-norm-001',
    profileId: 'prof-test-001',
    date: '2026-09-01',
    description: 'Whole Foods Market grocery shopping',
    amount: 142.50,
    currency: 'USD',
    convertedAmount: 142.50,
    baseCurrency: 'USD',
    category: 'Groceries',
    subcategory: 'Supermarket',
    type: 'expense',
    accountId: 'acc-checking-001',
    toAccountId: null,
    tags: ['groceries', 'household'],
    notes: 'Weekly pantry stockup',
    paymentMethod: 'card',
    merchant: 'Whole Foods Market',
    isSplit: false,
    splitParts: null,
    isRecurring: false,
    createdAt: '2026-09-01T10:15:00.000Z',
    updatedAt: '2026-09-01T10:15:00.000Z',
  },
  {
    id: 'tx-norm-002',
    profileId: 'prof-test-001',
    date: '2026-09-02',
    description: 'Monthly Software Engineering Consulting Retainer',
    amount: 5500.00,
    currency: 'USD',
    convertedAmount: 5500.00,
    baseCurrency: 'USD',
    category: 'Income',
    subcategory: 'Consulting',
    type: 'income',
    accountId: 'acc-checking-001',
    toAccountId: null,
    tags: ['retainer', 'client-acme'],
    notes: 'Direct deposit invoice #1042',
    paymentMethod: 'neft',
    merchant: 'Acme Corp',
    isSplit: false,
    splitParts: null,
    isRecurring: false,
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-02T09:00:00.000Z',
  },
];

export const INDIAN_BANK_TRANSACTIONS = [
  {
    id: 'tx-in-001',
    profileId: 'prof-in-001',
    date: '2026-08-15',
    description: 'UPI/CR/423190871234/SWIGGY BANGALORE/HDFC',
    amount: 489.00,
    currency: 'INR',
    convertedAmount: 489.00,
    baseCurrency: 'INR',
    category: 'Food & Dining',
    subcategory: 'Delivery',
    type: 'expense',
    accountId: 'acc-hdfc-001',
    toAccountId: null,
    tags: ['dinner', 'swiggy'],
    notes: 'Order #98124451',
    paymentMethod: 'upi',
    merchant: 'Swiggy',
    utrNumber: '423190871234',
    isSplit: false,
    isRecurring: false,
    createdAt: '2026-08-15T19:30:00.000Z',
    updatedAt: '2026-08-15T19:30:00.000Z',
  },
  {
    id: 'tx-in-002',
    profileId: 'prof-in-001',
    date: '2026-08-16',
    description: 'NEFT-AXIS0001928-INFOSYS SALARY AUGUST',
    amount: 185000.00,
    currency: 'INR',
    convertedAmount: 185000.00,
    baseCurrency: 'INR',
    category: 'Salary',
    subcategory: 'Primary Job',
    type: 'income',
    accountId: 'acc-hdfc-001',
    toAccountId: null,
    tags: ['salary', 'august'],
    notes: 'Monthly payroll',
    paymentMethod: 'neft',
    merchant: 'Infosys Ltd',
    utrNumber: 'AXIS0001928374',
    isSplit: false,
    isRecurring: false,
    createdAt: '2026-08-16T08:00:00.000Z',
    updatedAt: '2026-08-16T08:00:00.000Z',
  },
  {
    id: 'tx-in-003',
    profileId: 'prof-in-001',
    date: '2026-08-18',
    description: 'IMPS-629810293847-ZOMATO HYDERABAD-SBI',
    amount: 320.00,
    currency: 'INR',
    convertedAmount: 320.00,
    baseCurrency: 'INR',
    category: 'Food & Dining',
    subcategory: 'Delivery',
    type: 'expense',
    accountId: 'acc-sbi-001',
    toAccountId: null,
    tags: ['lunch'],
    paymentMethod: 'imps',
    merchant: 'Zomato',
    utrNumber: '629810293847',
    isSplit: false,
    isRecurring: false,
  },
];

export const MULTI_CURRENCY_TRANSACTIONS = [
  {
    id: 'tx-curr-eur',
    date: '2026-08-20',
    description: 'Eurostar London to Paris Ticket',
    amount: 180.00,
    currency: 'EUR',
    baseCurrency: 'USD',
    type: 'expense',
    accountId: 'acc-travel-001',
  },
  {
    id: 'tx-curr-jpy',
    date: '2026-08-22',
    description: 'Tokyo Midtown Hotel Accommodation',
    amount: 32000,
    currency: 'JPY',
    baseCurrency: 'USD',
    type: 'expense',
    accountId: 'acc-travel-001',
  },
  {
    id: 'tx-curr-gbp',
    date: '2026-08-25',
    description: 'UK Freelance Royalties',
    amount: 850.00,
    currency: 'GBP',
    baseCurrency: 'USD',
    type: 'income',
    accountId: 'acc-checking-001',
  },
];

export const TRANSFER_TRANSACTIONS = {
  transferId: 'trf-pair-9001',
  fromAccountId: 'acc-checking-001',
  toAccountId: 'acc-savings-002',
  amount: 1200.00,
  date: '2026-08-28',
  notes: 'Monthly emergency fund savings transfer',
  outflow: {
    id: 'tx-trf-out-001',
    transferId: 'trf-pair-9001',
    accountId: 'acc-checking-001',
    toAccountId: 'acc-savings-002',
    type: 'transfer',
    amount: 1200.00,
    date: '2026-08-28',
    category: 'Transfer',
    description: 'Transfer to Savings Account',
  },
  inflow: {
    id: 'tx-trf-in-001',
    transferId: 'trf-pair-9001',
    accountId: 'acc-savings-002',
    toAccountId: 'acc-checking-001',
    type: 'income',
    amount: 1200.00,
    date: '2026-08-28',
    category: 'Transfer',
    description: 'Transfer from Checking Account',
  },
};

export const SPLIT_TRANSACTION_FIXTURE = {
  parent: {
    id: 'tx-split-parent-101',
    date: '2026-08-30',
    description: 'Supercenter Big Store (Groceries + Electronics)',
    amount: 250.00,
    currency: 'USD',
    type: 'expense',
    accountId: 'acc-checking-001',
    category: 'Shopping',
    isSplit: true,
    splitParts: [
      { category: 'Groceries', amount: 150.00, notes: 'Food and vegetables' },
      { category: 'Electronics', amount: 100.00, notes: 'Replacement USB-C Hub' },
    ],
  },
  children: [
    {
      id: 'tx-split-child-001',
      splitParentId: 'tx-split-parent-101',
      date: '2026-08-30',
      description: 'Supercenter Big Store (Groceries + Electronics)',
      amount: 150.00,
      category: 'Groceries',
      type: 'expense',
      accountId: 'acc-checking-001',
      notes: 'Food and vegetables',
      isSplit: false,
    },
    {
      id: 'tx-split-child-002',
      splitParentId: 'tx-split-parent-101',
      date: '2026-08-30',
      description: 'Supercenter Big Store (Groceries + Electronics)',
      amount: 100.00,
      category: 'Electronics',
      type: 'expense',
      accountId: 'acc-checking-001',
      notes: 'Replacement USB-C Hub',
      isSplit: false,
    },
  ],
};

export const RECURRING_RULES_FIXTURES = {
  monthlySalary: {
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
  monthEndRent: {
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 31,
    startDate: '2026-01-31',
  },
  biweeklyGym: {
    frequency: 'weekly',
    interval: 2,
    startDate: '2026-08-01',
  },
};

export const MALFORMED_RECORDS = [
  { description: '', amount: 100, date: '2026-09-01', type: 'expense', accountId: 'acc-1' }, // Missing description
  { description: 'Invalid amount', amount: -50, date: '2026-09-01', type: 'expense', accountId: 'acc-1' }, // Negative amount
  { description: 'Zero amount', amount: 0, date: '2026-09-01', type: 'expense', accountId: 'acc-1' }, // Zero amount
  { description: 'String amount', amount: 'one hundred', date: '2026-09-01', type: 'expense', accountId: 'acc-1' }, // Not a number
  { description: 'Bad date format', amount: 25, date: '01/09/2026', type: 'expense', accountId: 'acc-1' }, // Non-ISO date
  { description: 'Invalid type', amount: 25, date: '2026-09-01', type: 'credit_card', accountId: 'acc-1' }, // Unknown type
  { description: 'Missing account', amount: 25, date: '2026-09-01', type: 'expense', accountId: '' }, // No account
  { description: 'Transfer same account', amount: 50, date: '2026-09-01', type: 'transfer', accountId: 'acc-1', toAccountId: 'acc-1' }, // Same source/target
];

export const MALICIOUS_INPUT_STRINGS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(document.domain)>',
  'javascript:alert("exploit")',
  'Swiggy \u0000 Technologies',
  'Robert\'); DROP TABLE transactions;--',
  '{{7*7}}',
  '${7*7}',
  '<iframe src="https://attacker.example/steal"></iframe>',
  '&lt;script&gt;eval(&#39;alert(1)&#39;)&lt;/script&gt;',
];

export const DUPLICATE_STATEMENT_SAMPLE = `Date,Description,Debit,Credit,Balance
15/08/2026,Swiggy Bangalore UPI/CR/1234,489.00,,12450.00
15/08/2026,Swiggy Bangalore UPI/CR/1234,489.00,,11961.00
16/08/2026,Starbucks Coffee Indiranagar,350.00,,11611.00
16/08/2026,Infosys Payroll NEFT,185000.00,,196611.00
16/08/2026,Amazon Retail India,50.00,,196561.00
16/08/2026,Amazon Retail India Return,,50.00,196611.00
`;
