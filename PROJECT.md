# Project: FinTrack Pro Hardening & Remediation

## Architecture
FinTrack Pro is a client-first, privacy-respecting personal finance SPA built with Vite, vanilla JavaScript modules, and IndexedDB (`fintrack-pro`).

### Layer Architecture
1. **Presentation Layer (`src/modules/`, `src/components/`)**:
   - UI views for Transactions, Accounts, Dashboard, Budgets, Reports, Analytics, Import, Goals, Investments, Net Worth, Corporate, Onboarding.
   - SPA Router (`src/router.js`) and Topbar/Sidebar navigation.
   - **Security Constraint**: Must use DOM sanitization helpers (`escapeHtml`, `safeAttr`, `safeSetHtml`, `html` tagged templates from `src/utils/security.js`) and avoid direct `innerHTML` string interpolations.
2. **Business Logic Layer (`src/modules/`, `src/services/`, `src/parsers/`)**:
   - Transaction Management & Split Engine (`src/modules/transactions/`).
   - Account Balance & Transfer Engine (`src/modules/accounts/`).
   - Multi-Currency Conversion & Rates Service (`src/services/currency.js`).
   - Bank Statement Parsers (CSV, OFX, PDF) & Bank Profiles (`src/parsers/`).
   - Categorization & OCR (`src/services/`).
   - Vault & Security (`src/services/credential-vault.js`, `src/services/network-guard.js`).
3. **Data Layer (`src/db.js`, `src/store.js`)**:
   - IndexedDB database `fintrack-pro` with object stores for `transactions`, `accounts`, `profiles`, `budgets`, `categories`, `exchangeRates`, `settings`, `credentials`.
   - Indexed access (`accountId`, `date`, `category`, `type`, `toAccountId`, `splitParentId`, `hash`).
   - In-memory pub/sub reactive store (`src/store.js`).

---

## Feature Inventory
Every feature from the Survey phase is mapped to a milestone.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Split Parent Filter | Exclude `isSplit === true` parent records from account balances, cash-flow totals, category shares, budget limits, reports, and corporate P&L | M1 | ORIGINAL_REQUEST §R1, survey |
| F2 | Cascade Split Deletion | Atomically delete all child transactions where `splitParentId === id` when a parent split is deleted | M1 | ORIGINAL_REQUEST §R1, survey |
| F3 | Symmetrical Transfer Model | Support both `type: 'transfer'` and paired `transferId` transfers symmetrically in `recalculateBalance` without data loss | M1 | ORIGINAL_REQUEST §R1, survey |
| F4 | Cross-Currency Native Balances | Calculate transfer debits/credits in native account currencies; eliminate base-currency convertedAmount contamination | M1 | ORIGINAL_REQUEST §R1, survey |
| F5 | Explicit Exchange Rate Errors | Throw explicit error on missing exchange rates instead of silent 1:1 fallback in `currency.js` and `transactions` | M1 | ORIGINAL_REQUEST §R1, survey |
| F6 | Canonical Account Schema | Standardize on `initialBalance` and `currentBalance` with non-destructive fallback to `openingBalance` and `balance` | M1 | ORIGINAL_REQUEST §R1, survey |
| F7 | Positive Statement Debits | Ensure imported statement debits are stored with positive amounts and `type: 'expense'` | M1 | survey (import/index.js) |
| F8 | Deduplication Hash Sign | Include transaction type/sign and reference in hash generation to prevent collision between debits and credits | M1 | ORIGINAL_REQUEST §R1, survey |
| F9 | Indexed Balance Calculations | Replace full `getAll('transactions')` scans with `getByIndex('transactions', 'accountId', id)` | M1 | ORIGINAL_REQUEST §R3, survey |
| F10 | Indexed Deduplication Queries | Query transaction hashes via date ranges or index instead of full table scans | M1 | ORIGINAL_REQUEST §R3, survey |
| F11 | Indexed Recurring Engine | Replace full table scans in recurring processing with indexed or targeted queries | M1 | ORIGINAL_REQUEST §R3, survey |
| F12 | Single-Account Direct Lookup | Replace `getAll('accounts').find(...)` in transaction loops with point lookup `getById('accounts', id)` | M1 | ORIGINAL_REQUEST §R3, survey |
| F13 | DB Schema Upgrade | Add indexes for `toAccountId`, `splitParentId`, and `hash` to `transactions` store in `src/db.js` | M1 | survey (src/db.js) |
| F14 | UI DOM Sanitization | Replace 40+ unsanitized `innerHTML` interpolation sites with `safeSetHtml`, `html` tagged templates, `safeAttr`, or `textContent` | M2 | ORIGINAL_REQUEST §R2, survey |
| F15 | Tag & Badge Sanitization | Escape tag strings, account options, category labels before rendering into DOM | M2 | ORIGINAL_REQUEST §R2, survey |
| F16 | Import Preview Sanitization | Sanitize imported file headers, bank names, descriptions before rendering preview tables | M2 | ORIGINAL_REQUEST §R2, survey |
| F17 | URL Hash Reflected XSS Fix | Sanitize URL hash in `topbar.js` (`getPageTitle()`) and `router.js` module fallback screen | M2 | survey (topbar.js, router.js) |
| F18 | Receipt OCR Privacy | Remove raw receipt OCR text `console.log` in `src/services/ocr.js` | M2 | ORIGINAL_REQUEST §R2, survey |
| F19 | DOMPurify Dependency Declaration | Ensure `dompurify` is explicitly declared in `package.json` dependencies | M2 | survey (src/utils/security.js) |
| F20 | Local PDF.js Bundling | Bundle `pdfjs-dist` locally in `src/parsers/pdf-parser.js` to eliminate `cdnjs.cloudflare.com` CDN | M3 | ORIGINAL_REQUEST §R4, survey |
| F21 | Offline Service Worker | Replace Google CDN Workbox script in `sw.js` with self-contained offline Cache API implementation | M3 | ORIGINAL_REQUEST §R4, survey |
| F22 | Offline Font Resilience | Ensure font styling falls back safely to system fonts without blocking on external Google CDN | M3 | survey (index.html) |
| F23 | Non-Breaking Vulnerability Patches | Apply `npm audit fix` for vulnerable packages (DOMPurify, fast-uri, nanoid, etc.) | M3 | ORIGINAL_REQUEST §R4, survey |
| F24 | Guard Spreadsheet Bounds | Enforce maximum file size (≤ 5MB) and row bounds (`sheetRows: 5000`) on `xlsx.read()` | M3 | ORIGINAL_REQUEST §R4, survey |
| F25 | Parser Regression Test Suite | Implement 80+ test cases covering 20 bank profiles (10 Indian, 10 International), CSV/OFX/PDF | M4 | ORIGINAL_REQUEST §R5, survey |
| F26 | Indian Banking Narration Tests | Test UPI, NEFT, IMPS, RTGS, cheque clearing, and lakh numbering formats | M4 | ORIGINAL_REQUEST §R5, survey |
| F27 | International Format Tests | Test European decimal commas (`1.234,56`), German dates (`DD.MM.YYYY`), 2-digit years | M4 | ORIGINAL_REQUEST §R5, survey |
| F28 | Financial Logic Unit Tests | Add tests for split double-counting prevention, cascade deletion, transfer symmetry, cross-currency balances, and rate error throwing | M4 | ORIGINAL_REQUEST §R5, survey |
| F29 | Security Utilities Tests | Add comprehensive unit tests for `src/utils/security.js` (`escapeHtml`, `safeAttr`, `safeUrl`, `safeSetHtml`, `html`) | M4 | survey |
| F30 | Coverage Threshold Tuning | Adjust Vitest coverage config to achieve ≥ 60% statement coverage across application source | M4 | ORIGINAL_REQUEST §Verification, survey |
| F31 | Final E2E Acceptance & Adversarial Hardening | Verify 100% test pass (≥150 tests), ≥60% statement coverage, 0 lint errors, clean production bundle, forensic clean audit | M5 | ORIGINAL_REQUEST §Verification, survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Financial Core & Storage Performance | R1 & R3: Split filter & cascade delete, transfer symmetry, cross-currency native accounting, rate errors, schema standardization, indexed queries & schema upgrade | Survey complete | PLANNED |
| M2 | DOM Sanitization & Rendering Security | R2: Remediate all `innerHTML` sites, tag/badge escaping, import preview sanitization, URL hash reflected XSS, OCR log removal, dompurify dependency | Survey complete | PLANNED |
| M3 | Offline Self-Containment & Supply Chain | R4: Local PDF.js bundling, offline service worker, Google font resilience, npm audit fix, xlsx bounds guard | M1, M2 | PLANNED |
| M4 | Test Suite & Parser Coverage Expansion | R5: Dual-track test suite, 80+ parser tests, Indian/international formats, security tests, financial logic tests, coverage >=60%, test count >=150 | M1, M2, M3 | PLANNED |
| M5 | Final Verification & Hardening Gate | Acceptance verification: pass 100% tests (≥150 tests), coverage ≥60%, 0 lint errors, clean build, Forensic Integrity Audit | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. `src/modules/transactions/index.js` ↔ `src/modules/accounts/index.js`
- **Transfer Representation**:
  - Single record: `{ id, accountId, toAccountId, type: 'transfer', amount, targetAmount, currency, targetCurrency, date, ... }`
  - Paired records: `{ id, accountId, type: 'expense'|'income', amount, category: 'Transfer', transferId, ... }`
- **Recalculation Contract**:
  - `recalculateBalance(accountId)` MUST query both `accountId` and `toAccountId`.
  - For single record: if `tx.accountId === accountId`, subtract `tx.amount`; if `tx.toAccountId === accountId`, add `tx.targetAmount ?? tx.amount`.
  - For paired records: process income and expense normally without double-counting.
  - MUST skip any transaction where `tx.isSplit === true`.

### 2. `src/services/currency.js` Contract
- `convert(amount, fromCurrency, toCurrency)`:
  - If `fromCurrency === toCurrency`, returns `amount`.
  - If rates cache is missing or rate for either currency is unavailable, throws:
    `new Error('Exchange rate unavailable from ${fromCurrency} to ${toCurrency}')`.
  - MUST NOT fall back to 1:1 silently.

### 3. `src/utils/security.js` Contract
- `escapeHtml(string)`: returns HTML entity encoded string.
- `safeAttr(string)`: returns attribute-safe encoded string.
- `safeSetHtml(element, dirty)`: sanitizes via DOMPurify and sets `element.innerHTML`.
- `html(strings, ...values)`: tagged template auto-escaping interpolated values unless marked with `raw()`.

### 4. `src/db.js` Schema Contract
- Database: `fintrack-pro`, Version: 4.
- Stores: `transactions` MUST include indexes:
  - `accountId` (`keyPath: 'accountId'`)
  - `toAccountId` (`keyPath: 'toAccountId'`)
  - `splitParentId` (`keyPath: 'splitParentId'`)
  - `date` (`keyPath: 'date'`)
  - `category` (`keyPath: 'category'`)
  - `type` (`keyPath: 'type'`)
  - `hash` (`keyPath: 'hash'`)

---

## Code Layout
- `src/db.js`: IndexedDB schema, migrations, connection management, indexed queries.
- `src/modules/transactions/`: Transaction manager, split logic, recurring rules, transaction UI.
- `src/modules/accounts/`: Account manager, balance recalculation, transfer helper, account UI.
- `src/services/currency.js`: Currency exchange rates, conversion logic.
- `src/services/ocr.js`: Receipt OCR processing.
- `src/parsers/`: Bank statement parsers (CSV, OFX, PDF), bank profiles, deduplication.
- `src/utils/security.js`: HTML escaping, DOMPurify wrapper, tagged template sanitizer.
- `src/modules/dashboard/`, `reports/`, `budgets/`, `analytics/`: Analytical views and reports.
- `sw.js`: Service worker for offline caching.
- `tests/unit/`: Unit tests for transactions, accounts, currency, parsers, security.
- `tests/integration/`: Integration flows (split transactions, cross-currency transfers, imports).
