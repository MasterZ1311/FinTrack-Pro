<div align="center">

# FinTrack Pro

### A Privacy-First, AI-Powered Personal Finance Tracker

[![Built With](https://img.shields.io/badge/Built%20With-Vanilla%20JS%20%2B%20Vite-6366f1?style=flat-square)](https://vitejs.dev)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-22c55e?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Offline First](https://img.shields.io/badge/Offline-First-f59e0b?style=flat-square)](#)
[![No Server Required](https://img.shields.io/badge/Backend-None%20(100%25%20Client--Side)-3b82f6?style=flat-square)](#)

</div>

---

## What Is FinTrack Pro?

**FinTrack Pro** is a fully client-side personal finance management application. It runs entirely in your browser — no accounts, no cloud storage, no data ever leaves your device. Every byte of your financial data is stored locally in your browser's IndexedDB.

It's designed for people who want a **powerful, professional-grade expense tracker** with zero privacy compromises.

---

## Key Features

### Dashboard & Analytics
- **Real-time financial overview** — income vs. expenses, net balance, and savings rate at a glance
- **Interactive charts** (powered by Chart.js) — spending trends, category breakdowns, cash flow
- **Smart KPIs** — monthly comparisons, streak tracking, top spending categories

### Transaction Management
- Add, edit, and delete transactions with full metadata (amount, category, account, notes, tags)
- **Recurring transactions** — set daily/weekly/monthly/yearly repeating entries that auto-generate
- **Advanced filtering** — by date range, category, account, type, and free-text search
- **Split transactions** — divide one payment across multiple categories
- **Bulk import** from bank statements (CSV, PDF, OFX/QFX)

### Bank Statement Import
- Supports **CSV, PDF, and OFX/QFX** file formats
- **Auto-detects your bank** from Indian and international bank profiles:
  - **Indian Banks**: SBI, HDFC, ICICI, Axis, Kotak, PNB, BOB, Canara, Federal, IDFC
  - **International Banks**: Chase, Wells Fargo, Barclays, ANZ, and more
- Smart **deduplication** — never import the same transaction twice
- **UPI transaction parsing** — extracts merchant names from Indian UPI/NEFT/IMPS descriptions

### AI-Powered Features
- **Automatic transaction categorization** with a 3-tier system:
  1. **Learned patterns** — remembers your manual corrections
  2. **Rule-based** — instant matching for 40+ known merchants (Swiggy, Uber, Amazon, etc.)
  3. **AI fallback** — uses WebLLM (on-device Gemma 2B) or your own API key (OpenAI/Anthropic-compatible)
- **AI Financial Assistant** — chat with your financial data, ask questions like "How much did I spend on food last month?"
- **Receipt scanning** via OCR (Tesseract.js) — photograph a receipt to extract amount & date automatically

### Budget Management
- Set **monthly/yearly/custom budgets** per category
- Real-time **budget progress bars** with color-coded alerts
- **Budget rollover** and carryover support
- Notifications when approaching or exceeding limits

### Multiple Accounts
- Track **checking, savings, credit cards, cash, wallets, and investment accounts**
- Per-account balance tracking with full transaction history
- **Multi-currency support** — 100+ world currencies with live exchange rates (cached 24h offline)
- Indian number formatting (Lakhs/Crores) for INR accounts

### Investments & Net Worth
- Track stocks, mutual funds, crypto, real estate, and other assets
- **Net worth timeline** — see your wealth grow over time
- P&L calculation per investment

### Reports & Export
- **PDF reports** with charts and summaries (via jsPDF + html2canvas)
- **Excel/CSV export** (via SheetJS/xlsx)
- Date-range reports, category reports, and account statements

### Corporate Mode
- Separate **corporate expense tracking** profile
- Categories suited for business (Client Entertainment, Travel & Accommodation, Office Supplies, etc.)
- Report generation for reimbursement submissions

### Financial Goals & Debt Tracker
- Set savings goals with target amounts and deadlines
- **Debt management** — track loans, EMIs, and payoff progress

### Settings & Customization
- **Dark mode** (default) with custom color themes
- Custom expense categories with icons and colors
- Currency and locale preferences
- Data export/import (full backup & restore as JSON)
- AES-256 encrypted backup export

### Progressive Web App & Native System Installation
- **Install on any device** — install as a standalone native app on Windows, macOS, Linux, iOS, and Android
- **Full offline support** — all features work with zero internet connectivity
- **See [docs/INSTALLATION.md](docs/INSTALLATION.md)** for detailed installation steps per operating system.

---

## Getting Started

### For End Users
Open FinTrack Pro in any modern browser, or click **"Install App"** in the sidebar to run it as a standalone system application. No login or signup required.

### For Developers & Testing

**Prerequisites**: Node.js 18+ and npm

```bash
# 1. Install dependencies
npm install

# 2. Run unit & integration tests (197 tests, 100% pass)
npm test

# 3. Run Playwright E2E & Axe accessibility audits (8 suites, 100% pass)
npm run test:e2e

# 4. Run ESLint code quality audit (0 errors, 0 warnings)
npm run lint

# 5. Build production bundle
npm run build

# 6. Preview production build locally
npm run preview
```

The production build outputs to the `dist/` folder. Host it on any static file server — Netlify, Vercel, GitHub Pages, Nginx, or similar.

---

## Project Structure

```
Expense Tracker/
├── index.html          # App shell + global CSS variables
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (Workbox-based caching)
├── vite.config.js      # Build configuration
├── package.json        # Dependencies & scripts
└── src/
    ├── main.js         # App entry point & bootstrap
    ├── router.js       # Hash-based SPA router
    ├── store.js        # Reactive state management
    ├── db.js           # IndexedDB wrapper (CRUD operations)
    ├── crypto.js       # AES-256 encryption utilities
    ├── modules/        # Feature modules (one folder per page)
    │   ├── dashboard/
    │   ├── transactions/
    │   ├── analytics/
    │   ├── budgets/
    │   ├── accounts/
    │   ├── ai/
    │   ├── reports/
    │   ├── import/
    │   ├── corporate/
    │   ├── settings/
    │   ├── networth/
    │   ├── investments/
    │   ├── goals/
    │   ├── debt/
    │   └── onboarding/
    ├── services/       # Shared business logic
    │   ├── ai-engine.js
    │   ├── categorizer.js
    │   ├── currency.js
    │   ├── ocr.js
    │   ├── user-api.js
    │   └── webllm-loader.js
    ├── parsers/        # Bank statement parsers
    │   ├── csv-parser.js
    │   ├── pdf-parser.js
    │   ├── ofx-parser.js
    │   ├── deduplication.js
    │   └── bank-profiles/
    │       ├── india/  (SBI, HDFC, ICICI, Axis, Kotak, PNB, BOB...)
    │       └── world/  (International banks)
    ├── styles/         # Modular CSS
    └── utils/          # Shared utility functions
```

---

## Privacy & Security

| Concern | Answer |
|---|---|
| Where is my data stored? | 100% in your browser (IndexedDB) |
| Does it send data to a server? | Never. Zero network requests for your data |
| What about AI features? | On-device (WebLLM/Gemma 2B) by default. Optionally, use your own API key |
| Can I export my data? | Yes — full JSON backup, CSV, or encrypted AES-256 export |
| Can I use it offline? | Yes — full functionality offline after first load |

---

## Technology Stack

| Technology | Purpose |
|---|---|
| **Vite** | Build tool & dev server |
| **Vanilla JavaScript (ES Modules)** | Zero framework overhead |
| **IndexedDB (via idb)** | Client-side persistent storage |
| **Chart.js** | Interactive financial charts |
| **@mlc-ai/web-llm** | On-device LLM (Gemma 2B via WebGPU) |
| **Tesseract.js** | On-device OCR for receipt scanning |
| **PapaParse** | CSV parsing |
| **jsPDF + html2canvas** | PDF report generation |
| **SheetJS (xlsx)** | Excel export |
| **Workbox** | Service Worker & PWA caching |
| **Web Crypto API** | AES-256-GCM encryption |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test in a browser: `npm run dev`
5. Submit a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Your finances. Your device. Your privacy.**

</div>
