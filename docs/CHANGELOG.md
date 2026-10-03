# Changelog — FinTrack Pro Hardening & Remediation

All notable changes made during the comprehensive hardening and audit remediation process.

---

## [1.0.0-hardened] — 2026-10-03

### Financial Correctness & Ledger Integrity (Phase 1)
- **Split Transaction Double-Counting**: Excluded `isSplit === true` parent transactions from balance calculation loops, dashboard KPIs, analytics trends, zero-based budgeting, reports, and corporate P&L.
- **Cascade Deletion**: Implemented atomic cascade deletion in `deleteTransaction()` to automatically remove all linked child sub-transactions when a split parent is deleted.
- **Symmetrical Transfers**: Refactored `recalculateBalance()` to support both single-record `type: 'transfer'` and paired `transferId` transfers symmetrically.
- **Native Cross-Currency Accounting**: Fixed transfer calculations so that cross-currency transfers debit source accounts in native source currency and credit target accounts using `targetAmount` in native target currency.
- **Strict Currency Rates**: Replaced silent 1:1 fallback in `currency.js` and `transactions/index.js` with explicit error throwing when exchange rates are unavailable.
- **Canonical Schema**: Standardized account schema on `initialBalance` and `currentBalance` with non-destructive fallback support for legacy `openingBalance` and `balance`.
- **Statement Debit Normalization**: Ensured imported debits are stored with positive amounts and marked as `type: 'expense'`.
- **Deduplication Hash Collision Fix**: Enhanced `generateHash()` in `deduplication.js` to include transaction type/sign.

### Security, Cryptography & Privacy (Phase 2)
- **Client-Side Credential Vault**: Implemented `src/services/credential-vault.js` providing AES-256-GCM encryption at rest in IndexedDB using PBKDF2 (100,000 iterations) with tab-scoped ephemeral session key in `sessionStorage`.
- **Zero Plaintext Storage**: Eliminated plaintext API keys and secrets from browser `localStorage`. Added legacy plaintext migration banner and scrubber in Settings view.
- **Truthful Network Privacy Layer**: Implemented `src/services/privacy-manager.js` and `src/services/network-guard.js` enforcing `LOCAL_ONLY` by default, `PRIVACY_ENHANCED`, and `EXTERNAL_AI_ENABLED` modes with immediate in-memory cutoff.
- **PII Scrubbing & Summarization**: Created `src/services/privacy-projection.js` to strip card numbers, account numbers, UTRs, notes, and raw transactions prior to external AI consumption.
- **Secure Gemini Header**: Migrated Google AI API calls to `x-goog-api-key` header to eliminate key exposure in URL query strings.
- **XSS & DOM Sanitization**: Created `src/utils/security.js` with `escapeHtml`, `safeAttr`, `safeUrl`, `safeSetHtml`, and `html` tagged template literals. Replaced untrusted `innerHTML` sites across transactions, accounts, and import modules.
- **Reflected URL Hash XSS Fix**: Neutralized arbitrary script execution via URL hash manipulation in `topbar.js` and `router.js`.
- **OCR Privacy**: Removed raw receipt OCR text `console.log` from `src/services/ocr.js`.

### Performance & IndexedDB (Phase 3)
- **IndexedDB Schema Upgrade**: Bumped database version to `4` in `src/db.js`, adding indexes for `toAccountId`, `splitParentId`, and `hash`.
- **Index-Powered Balance Recalculation**: Converted `recalculateBalance()` from full `getAll('transactions')` scans to targeted `getByIndex('transactions', 'accountId', id)` and `toAccountId` lookups.
- **Direct Point Lookups**: Replaced `getAll('accounts').find(...)` scans with point lookup `getById('accounts', id)`.

### Offline PWA & Supply Chain (Phase 4)
- **Local PDF.js Bundling**: Bundled `pdfjs-dist` locally in `src/parsers/pdf-parser.js`, eliminating runtime calls to `cdnjs.cloudflare.com`.
- **Self-Contained Service Worker**: Rewrote `sw.js` using native Cache API (`v2`) with StaleWhileRevalidate for assets and CacheFirst for images, removing external Google Workbox CDN scripts.
- **Offline Font Resilience**: Made Google Fonts in `index.html` non-blocking with local system font fallback.
- **Vulnerability Patches**: Executed `npm audit fix` for non-breaking package updates and enforced spreadsheet export bounds in `reports/index.js`.

### Automated Testing & Verification (Phase 5)
- **Testing Infrastructure**: Installed Vitest, jsdom, and fake-indexeddb. Added unit and integration suites.
- **Test Count**: Grew automated test suite from 0 to 192 tests across 18 test files (100% passing).
- **Parser Regression Suite**: Added `tests/unit/parsers.test.js` covering Indian bank statement formats (HDFC, SBI, ICICI, Axis), UPI/NEFT/IMPS narrations, lakh formats, international dates/numbers, and OFX SGML parsing.
- **PDF Parser Tests**: Added `tests/unit/pdf-parser.test.js` testing coordinate row grouping, header detection, and regex fallback.
- **Dashboard & Budgets Tests**: Added `tests/unit/dashboard-budgets.test.js` testing KPIs, savings rate, and envelope spending logic.
- **Security Utilities Tests**: Added `tests/unit/security.test.js` verifying HTML escaping, URL sanitization, and tagged template formatting.
