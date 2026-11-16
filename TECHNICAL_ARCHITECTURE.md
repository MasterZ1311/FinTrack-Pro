# FinTrack Pro — Technical Architecture Reference

> **Audience**: Developers who want to understand the internal architecture, data flow, and module contracts to reproduce, extend, or fork this project.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Repository Layout](#2-repository-layout)
3. [Build System](#3-build-system)
4. [Application Bootstrap Sequence](#4-application-bootstrap-sequence)
5. [Routing Architecture](#5-routing-architecture)
6. [State Management (Store)](#6-state-management-store)
7. [Data Persistence Layer (IndexedDB)](#7-data-persistence-layer-indexeddb)
8. [Module System](#8-module-system)
9. [Services Layer](#9-services-layer)
10. [Statement Parsers](#10-statement-parsers)
11. [AI / LLM Integration](#11-ai--llm-integration)
12. [PWA & Service Worker](#12-pwa--service-worker)
13. [Encryption](#13-encryption)
14. [CSS Architecture](#14-css-architecture)
15. [Data Schemas](#15-data-schemas)
16. [Full Data Flow Diagrams](#16-full-data-flow-diagrams)
17. [External APIs & Dependencies](#17-external-apis--dependencies)
18. [Replicating This Infrastructure](#18-replicating-this-infrastructure)

---

## 1. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Build Tool | Vite | ^8.2.0 | ESM-native, no bundler magic needed |
| Language | Vanilla JavaScript | ES2022+ | Native ESM, no TypeScript, no framework |
| Storage | IndexedDB via `idb` | ^8.0.3 | Typed wrapper around raw IndexedDB |
| Charts | Chart.js | ^4.5.1 | Canvas-based charting |
| On-device LLM | `@mlc-ai/web-llm` | ^0.2.84 | WebGPU-accelerated Gemma 2B model |
| OCR | Tesseract.js | ^7.0.0 | WASM-based Tesseract in-browser |
| CSV Parsing | PapaParse | ^5.5.4 | Streaming CSV parser |
| PDF Parsing | pdf-parse | ^2.4.5 | PDF text extraction |
| PDF Export | jsPDF | ^4.2.1 | Client-side PDF generation |
| Screenshots | html2canvas | ^1.4.1 | DOM → Canvas for PDF charts |
| Excel Export | xlsx (SheetJS) | ^0.18.5 | Excel/CSV read-write |
| Icons | lucide | ^1.28.0 | SVG icon library |
| PWA Caching | Workbox CDN | 7.0.0 | Service Worker strategy library |
| Encryption | Web Crypto API | Native | AES-256-GCM, PBKDF2, browser-native |

**Zero server-side components.** Everything runs in the browser.

---

## 2. Repository Layout

```
Expense Tracker/
│
├── index.html                    # App shell HTML; global CSS design tokens
├── manifest.json                 # PWA Web App Manifest (source)
├── sw.js                         # Service Worker (Workbox-based caching)
├── vite.config.js                # Vite build configuration
├── package.json                  # npm scripts + dependency declarations
├── package-lock.json
│
├── dist/                         # Production build output
├── public/                       # Static assets copied verbatim to dist/
│   ├── manifest.json             # Root-served PWA manifest
│   ├── favicon.svg
│   └── icons.svg
│
├── docs/                         # Architecture, installation & compliance guides
│   ├── INSTALLATION.md           # Native system installation across all operating systems
│   ├── CHANGELOG.md              # Version releases and upgrade notes
│   ├── SECURITY.md               # Threat model, encryption & zero-knowledge guarantees
│   └── CODEBASE_AUDIT.md         # Comprehensive architectural audit report
│
├── brag-output/                  # Launch video artifacts (brag / brag-slim)
│   ├── brag.mp4                  # 1080p 30fps launch showcase video with synced stereo audio
│   ├── brag.jpg                  # Settled poster thumbnail
│   ├── brag-plan.md              # Scene-by-scene storyboard and creative brief
│   └── share-copy.txt            # Ready-to-post launch copy
│
├── tests/                        # Comprehensive test suites (100% pass)
│   ├── unit/                     # Fast unit suites (197 Vitest tests)
│   ├── integration/              # Multi-tier integration suites
│   ├── e2e/                      # Playwright E2E & Axe accessibility audits
│   └── manual/                   # Manual verification scripts (test-categorizer.js)
│
└── src/
    ├── main.js                   # Bootstrap: DB → Store → Router → SW → PWA Installer
    ├── router.js                 # Hash-based SPA router
    ├── store.js                  # Global reactive state (pub/sub)
    ├── db.js                     # IndexedDB abstraction (CRUD + migration)
    ├── crypto.js                 # AES-256-GCM encrypt/decrypt via Web Crypto
    ├── network-guard.js          # Zero-knowledge outbound network proxy
    │
    ├── modules/                  # Feature modules (page-level, lazy-loaded)
    │   ├── dashboard/
    │   │   ├── index.js          # Dashboard page renderer
    │   │   ├── sidebar.js        # Sidebar nav component
    │   │   └── topbar.js         # Top bar component
    │   ├── transactions/
    │   │   ├── index.js          # Transactions CRUD page (largest file, ~64KB)
    │   │   ├── categories.js     # Default & custom category definitions
    │   │   ├── recurring.js      # Recurring transaction engine
    │   │   └── schema.js         # Transaction data schema & validators
    │   ├── analytics/index.js
    │   ├── budgets/index.js
    │   ├── accounts/index.js
    │   ├── ai/index.js
    │   ├── reports/index.js
    │   ├── import/index.js
    │   ├── corporate/index.js
    │   ├── settings/index.js
    │   ├── networth/index.js
    │   ├── investments/index.js
    │   ├── goals/index.js
    │   ├── debt/index.js
    │   └── onboarding/index.js
    │
    ├── services/                 # Shared business logic / integrations
    │   ├── ai-engine.js          # AI tier selector + unified complete() API
    │   ├── categorizer.js        # 3-tier categorization (learned→rules→AI)
    │   ├── currency.js           # 100+ currency definitions + exchange rates
    │   ├── ocr.js                # Tesseract.js OCR wrapper
    │   ├── user-api.js           # External LLM API proxy (OpenAI-compatible)
    │   └── webllm-loader.js      # WebLLM engine download & inference
    │
    ├── parsers/                  # Bank statement parsing pipeline
    │   ├── index.js              # Entry point: format detect → parse → dedup
    │   ├── csv-parser.js         # CSV parsing + bank profile matching
    │   ├── pdf-parser.js         # PDF text extraction + transaction parsing
    │   ├── ofx-parser.js         # OFX/QFX XML parsing
    │   ├── deduplication.js      # Fuzzy dedup against existing transactions
    │   ├── bank-profiles/
    │   │   ├── index.js          # Profile registry + detection logic
    │   │   ├── india/            # 10 Indian bank profiles
    │   │   │   ├── sbi.js, hdfc.js, icici.js, axis.js, kotak.js
    │   │   │   ├── pnb.js, bob.js, canara.js, federal.js, idfc.js
    │   │   └── world/            # International bank profiles
    │   └── __tests__/            # Parser unit tests
    │
    ├── styles/                   # Modular CSS (imported inline by modules)
    │   ├── tokens.css            # CSS custom properties (design tokens)
    │   ├── base.css              # Global reset + base styles
    │   ├── components.css        # Shared component styles (cards, buttons, forms)
    │   ├── animations.css        # Keyframe animations
    │   ├── sidebar.css           # Sidebar-specific styles
    │   ├── dashboard.css         # Dashboard-specific styles
    │   ├── onboarding.css        # Onboarding-specific styles
    │   └── themes.css            # Theme overrides (light/dark)
    │
    └── utils/
        └── icons.js              # Lucide icon wrappers (SVG strings)
```

---

## 3. Build System

**Vite** is the only build tool. Configuration is minimal:

```js
// vite.config.js
export default defineConfig({
  base: './',          // Relative asset paths (works on any subdirectory host)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: true,        // Auto-opens browser on npm run dev
  },
});
```

### Key Build Behaviors
- **Code splitting**: Each module in `src/modules/*/index.js` is a dynamic `import()` → Vite automatically splits them into separate chunks
- **No transpilation target**: Targets modern browsers natively (no Babel, no polyfills)
- **ESM output**: Production build emits native ES modules
- **Asset hashing**: All static assets get content-hash suffixes for cache busting

### npm Scripts
```bash
npm run dev       # Start Vite dev server (HMR enabled)
npm run build     # Production build → dist/
npm run preview   # Serve dist/ locally to verify production build
```

---

## 4. Application Bootstrap Sequence

`index.html` loads `src/main.js` as a module. The `DOMContentLoaded` event triggers `bootstrap()`.

```
DOMContentLoaded
      │
      ▼
bootstrap() — src/main.js
      │
      ├─ 1. migrate()           ← db.js: localStorage → IndexedDB migration (idempotent)
      │
      ├─ 2. getAll('profiles')  ← db.js: load user profile into store
      │
      ├─ 3. Promise.all([       ← db.js: parallel load of all collections
      │       getAll('accounts'),
      │       getAll('transactions'),
      │       getAll('budgets'),
      │       getAll('categories'),
      │       getAll('investments')
      │     ])
      │     → store.batchUpdate({ accounts, transactions, budgets, categories, investments })
      │
      ├─ 4. store.loadSettings()  ← load settings from IndexedDB into store
      │
      ├─ 5. processRecurring()    ← transactions/recurring.js (non-blocking)
      │       Checks for missed recurring transactions and creates them
      │
      ├─ 6. initSidebar()         ← modules/dashboard/sidebar.js
      │      initTopbar()         ← modules/dashboard/topbar.js
      │
      ├─ 7. initRouter()          ← router.js
      │       • Listens for hashchange events
      │       • Checks if a profile exists (→ onboarding if not)
      │       • Navigates to current hash or #/dashboard
      │
      └─ 8. registerServiceWorker()  ← registers sw.js
```

**Error handling**: If any step throws, `bootstrap()` catches it and renders a retry button in `#app-content`. This prevents silent white-screen failures.

---

## 5. Routing Architecture

The router (`src/router.js`) is a **hash-based SPA router** — no server-side routing required, works on any static file host.

### Route Table

```js
const routes = {
  '#/onboarding':   () => import('./modules/onboarding/index.js'),
  '#/dashboard':    () => import('./modules/dashboard/index.js'),
  '#/transactions': () => import('./modules/transactions/index.js'),
  '#/analytics':    () => import('./modules/analytics/index.js'),
  '#/budgets':      () => import('./modules/budgets/index.js'),
  '#/accounts':     () => import('./modules/accounts/index.js'),
  '#/ai':           () => import('./modules/ai/index.js'),
  '#/reports':      () => import('./modules/reports/index.js'),
  '#/import':       () => import('./modules/import/index.js'),
  '#/corporate':    () => import('./modules/corporate/index.js'),
  '#/settings':     () => import('./modules/settings/index.js'),
  '#/networth':     () => import('./modules/networth/index.js'),
  '#/investments':  () => import('./modules/investments/index.js'),
};
```

### Route Change Flow

```
window.hashchange event
        │
        ▼
handleRouteChange()
        │
        ├─ if route !== '#/onboarding' → checkProfile()
        │       if no profile → navigate('#/onboarding'); return
        │
        ├─ store.setState('currentRoute', hash)
        │
        ├─ Lookup routeLoader = routes[hash]
        │
        ├─ Show loading spinner in #app-content
        │
        ├─ currentModule?.destroy()   ← cleanup previous module
        │
        ├─ await routeLoader()        ← dynamic import (Vite chunk)
        │
        └─ module.default.render(appContent)
           OR module.render(appContent)
           OR show "coming soon" placeholder
```

### Module Contract

Every module must export either:
```js
// Named export
export function render(container) { ... }
export function destroy() { ... }  // optional cleanup

// OR default export
export default {
  render(container) { ... },
  destroy() { ... },   // optional
};
```

The `render(container)` function receives the `#app-content` HTMLElement and is responsible for populating it.

---

## 6. State Management (Store)

`src/store.js` implements a **singleton observer pattern** — no Redux, no Signals, no reactivity framework.

### State Shape

```js
const initialState = {
  profile: null,           // { id, name, type, currency, ... }
  accounts: [],            // Account[]
  transactions: [],        // Transaction[]
  budgets: [],             // Budget[]
  categories: [],          // Category[]
  investments: [],         // Investment[]
  settings: {},            // { currency, theme, ... } — persisted to IDB
  currentRoute: '',        // Active hash route
  notifications: [],       // { id, type, message, timestamp }[]
  filters: {               // Transaction view filters
    dateRange: null,
    category: null,
    account: null,
    type: null,
    search: '',
  },
};
```

### Store API

```js
import { store } from './store.js';

// Read
store.state                        // Full state object (direct reference)
store.getState('transactions')     // Get specific key

// Write
store.setState('accounts', [...])  // Set + notify subscribers
store.batchUpdate({ a: 1, b: 2 }) // Multiple keys at once

// Subscribe
const unsubscribe = store.subscribe('transactions', (newVal, oldVal) => { ... });
const unsubscribeAll = store.subscribeAll((key, newVal, oldVal) => { ... });
unsubscribe();  // Call returned function to stop listening

// Notifications (in-app toast system)
store.notify({ type: 'success', message: 'Saved!', duration: 3000 });
store.dismissNotification(id);

// Settings auto-persist
store.setState('settings', { currency: 'INR', theme: 'dark' });
// → triggers _persistSettings() → writes each key to IndexedDB 'settings' store

// Reset all state
store.reset();
```

### Settings Persistence

When `store.setState('settings', value)` is called, `_persistSettings()` runs automatically:
- Each `key/value` pair is written to IndexedDB `settings` object store as `{ key, value }`
- On app load, `store.loadSettings()` reads all settings records back and hydrates `store.state.settings`
- Internal flags prefixed with `localstorage_` are filtered out during load

---

## 7. Data Persistence Layer (IndexedDB)

`src/db.js` wraps the `idb` library to provide a clean CRUD interface.

### Database Config

```
DB Name:    fintrack-pro
DB Version: 1
```

### Object Stores

| Store Name | Key Path | Indexes |
|---|---|---|
| `profiles` | `id` | — |
| `transactions` | `id` | `date`, `accountId`, `category`, `type` |
| `accounts` | `id` | — |
| `investments` | `id` | — |
| `budgets` | `id` | — |
| `categories` | `id` | — |
| `bankProfiles` | `id` | — |
| `aiCache` | `id` | — |
| `exchangeRates` | `currency` | — |
| `settings` | `key` | — |

### CRUD API

```js
import { getAll, getById, add, update, remove, clear, getByIndex, getByRange, migrate } from './db.js';

// All operations are async/await
await getAll('transactions')           // → Transaction[]
await getById('accounts', 'acct-123') // → Account | undefined
await add('transactions', record)      // → IDBValidKey (throws if key exists)
await update('transactions', record)   // → IDBValidKey (upsert semantics)
await remove('transactions', 'tx-id') // → void
await clear('transactions')           // → void (delete all records)

// Index queries
await getByIndex('transactions', 'category', 'Food & Dining') // → Transaction[]
await getByRange('transactions', 'date', IDBKeyRange.bound('2025-01-01', '2025-01-31'))
```

### Migration System

On every app start, `migrate()` runs once (idempotent):

```
migrate()
  │
  ├─ Check IDB settings['localstorage_migrated'] → if true, skip
  │
  ├─ Read localStorage['adv_transactions'] → parse JSON → write to IDB
  │
  ├─ Read localStorage['adv_budgets']      → parse JSON → write to IDB
  │
  └─ Set settings['localstorage_migrated'] = true
```

This handles migrating data from any older localStorage-based version of the app.

---

## 8. Module System

Each module in `src/modules/` is a **self-contained feature page**. They are dynamically imported by the router, which means they are:
- **Code-split** — only loaded when the route is visited
- **Isolated** — each module manages its own DOM within `#app-content`
- **Stateful** — they read from and write to the global store

### Module Internal Pattern

Most modules follow this internal structure:

```js
// src/modules/example/index.js

import { store } from '../../store.js';
import { getAll, add, update, remove } from '../../db.js';

// Local state (module-scoped, destroyed on navigate away)
let localData = [];

// Render: Called by router, receives the container HTMLElement
export async function render(container) {
  localData = store.getState('someData');
  
  container.innerHTML = buildHTML(localData);
  
  attachEventListeners(container);
  subscribeToStore();
}

// Optional: Called by router before navigating away
export function destroy() {
  // Remove event listeners, cancel timers, etc.
}

function buildHTML(data) {
  return `<div>...</div>`;  // String template, no virtual DOM
}

function attachEventListeners(container) {
  container.querySelector('#btn-add')?.addEventListener('click', handleAdd);
}

function subscribeToStore() {
  store.subscribe('someData', (newData) => {
    // Re-render or update specific DOM nodes
  });
}
```

### Notable Modules

#### `transactions/index.js` (~64KB)
The largest and most complex module. Contains:
- Full transaction CRUD UI with modal forms
- Filtering, sorting, pagination
- Inline category editing
- Split transaction UI
- Attachment handling

#### `transactions/recurring.js`
The recurring transaction engine:
- Reads all transactions where `isRecurring === true`
- Computes the next due date based on `recurrenceRule`
- Creates new transactions for all missed occurrences since last run
- Updates `lastProcessed` timestamp

#### `transactions/schema.js`
Defines the normalized transaction object:
```js
{
  id: crypto.randomUUID(),
  date: 'YYYY-MM-DD',         // ISO date string
  description: string,
  amount: number,              // Always positive
  type: 'income' | 'expense' | 'transfer',
  category: string,
  accountId: string,
  currency: string,            // ISO 4217 code
  notes: string,
  tags: string[],
  isRecurring: boolean,
  recurrenceRule: object,      // { frequency, interval, endDate }
  importedFrom: string,        // Bank profile ID if imported
  createdAt: ISO8601 string,
  updatedAt: ISO8601 string,
}
```

#### `dashboard/sidebar.js` & `dashboard/topbar.js`
These are mounted once at bootstrap and persist across route changes (they are NOT in `#app-content`). They are mounted into `#sidebar` and `#topbar` respectively, which are part of the permanent app shell.

---

## 9. Services Layer

`src/services/` contains shared business logic that is used across multiple modules.

### `currency.js`

- **`CURRENCIES`**: Array of 100+ currency objects with `{ code, name, symbol, locale, decimals }`
- **`fetchExchangeRates(baseCurrency)`**: Fetches from `open.er-api.com`, caches result in IDB `exchangeRates` store for 24 hours. Falls back to cached data on network failure.
- **`convert(amount, from, to)`**: Converts between currencies using cached rates
- **`formatCurrency(amount, code, locale)`**: Uses `Intl.NumberFormat` with fallback to custom symbol
- **`formatCompact(amount, code)`**: Formats large numbers as `1.2L`, `3.4Cr` (Indian) or `1.2M`, `3.4B` (international)
- **`detectCurrencyFromLocale(locale)`**: Auto-detects currency from browser locale

### `ocr.js`

Uses **Tesseract.js** to OCR an image (File, Blob, or base64):

```
extractTransactionFromImage(image)
    │
    ├─ Tesseract.recognize(image, 'eng')
    │     → raw text
    │
    ├─ Amount extraction:
    │     regex /[\d,]+\.\d{2}|[\d,]+/g  →  pick largest number
    │
    └─ Date extraction:
          regex for DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
          → normalize to YYYY-MM-DD (input[type=date] format)
```

### `webllm-loader.js`

Manages the WebLLM engine lifecycle:

```
downloadModel(onProgress)
    │
    ├─ Guard: skip if already downloading or cached
    ├─ webllm.CreateMLCEngine('gemma-2-2b-it-q4f16_1-MLC', { initProgressCallback })
    └─ stores engine in module-scoped engineCache

generate(messages, options)
    ├─ Gets engine from cache
    ├─ Prepends system prompt: "You are FinTrack Pro, an AI financial assistant..."
    └─ engine.chat.completions.create({ messages, max_tokens, temperature })
       → returns content string
```

**Model**: `gemma-2-2b-it-q4f16_1-MLC` (Gemma 2B, 4-bit quantized, MLC format)
**Requirement**: WebGPU support (`navigator.gpu !== undefined`)

### `user-api.js`

OpenAI-compatible API client for external LLM use:

```js
// User configures via Settings → AI section
setApiConfig({ endpoint, key, model })
getApiConfig()   // returns config or null

// Call the configured API
callUserApi(messages)
    // → POST to endpoint with OpenAI-format body
    // → returns assistant message content
```

Supports any OpenAI-compatible endpoint (OpenAI, Anthropic via proxy, local Ollama, LM Studio, etc.)

### `categorizer.js`

**3-tier categorization pipeline**:

```
categorize(description, categories)
    │
    ├─ Tier 1: getLearnedPattern(description)
    │     Checks in-memory aiCache Map (user corrections)
    │     → { category, confidence: 1.0, method: 'learned' }
    │
    ├─ Tier 2: ruleBasedCategorize(description)
    │     Checks MERCHANT_MAPPING (~40 merchants)
    │     Also extracts merchant from UPI/NEFT/IMPS format strings
    │     → { category, confidence: 0.9, method: 'rules' }
    │
    └─ Tier 3: categorizeWithAI(description, categories)
          if API configured → callUserApi(prompt)
          if WebLLM loaded  → generate(prompt, { max_tokens: 50 })
          else              → { category: 'Uncategorized', confidence: 0 }
```

**Prompt template for AI tier**:
```
You are a financial categorizer. Given a bank transaction description,
return the most appropriate category from the list provided.
List: [Food & Dining, Transport, Shopping, ...]
Transaction: "UBER TRIP 9845678901"
Respond with ONLY: {"category": "...", "confidence": 0.0-1.0}
```

**Learning**: `recordUserCorrection(description, category)` stores the mapping in the in-memory `aiCache` Map. This is session-scoped (resets on page refresh). For persistent learning, the aiCache IDB store exists but full persistence is not yet wired.

---

## 10. Statement Parsers

`src/parsers/` implements the complete bank statement import pipeline.

### Entry Point Flow

```
parseStatement(file, options)
    │
    ├─ Step 1: detectFileFormat(filename, mimeType)
    │     Extension match → 'csv' | 'pdf' | 'ofx'
    │     If unknown: read first 4KB → detectFormatFromContent()
    │
    ├─ Step 2: Resolve bank profile (if bankProfileId provided)
    │
    ├─ Step 3: Route to parser
    │     'csv' → readFileAsText()  → parseBankCSV(text, profile)
    │     'pdf' → readFileAsArrayBuffer() → parseBankPDF(buffer, profile)
    │     'ofx' → readFileAsText()  → parseOFX(text)
    │
    ├─ Step 4: Sort transactions by date (newest first)
    │
    ├─ Step 5: deduplicateBatch(transactions)
    │     Compares against existing IDB transactions by (date, amount, description)
    │
    └─ Step 6: createSummary(transactions, duplicates)
         Returns ParseResult:
         {
           transactions: NormalizedTransaction[],
           duplicates: NormalizedTransaction[],
           bankProfile: object | null,
           format: 'csv' | 'pdf' | 'ofx',
           errors: string[],
           summary: { totalTransactions, duplicatesSkipped, dateRange, totalDebit, totalCredit, netAmount }
         }
```

### Bank Profile Schema

Each bank profile is a JS object:

```js
// Example: src/parsers/bank-profiles/india/hdfc.js
export default {
  id: 'hdfc',
  name: 'HDFC Bank',
  country: 'IN',
  type: 'csv',
  // Column mappings (0-indexed)
  columns: {
    date: 0,
    description: 1,
    debit: 2,
    credit: 3,
    balance: 4,
  },
  dateFormat: 'DD/MM/YY',    // or 'DD-MM-YYYY', 'YYYY-MM-DD', etc.
  skipRows: 1,               // Header rows to skip
  detectKeywords: ['HDFC Bank', 'HDFC Ltd'],   // Text to detect in PDF/CSV header
};
```

### Supported Indian Banks

`sbi`, `hdfc`, `icici`, `axis`, `kotak`, `pnb`, `bob` (Bank of Baroda), `canara`, `federal`, `idfc`

### Deduplication Logic (`deduplication.js`)

```
deduplicateBatch(newTransactions)
    │
    ├─ Load existing transactions from IDB
    │
    └─ For each new transaction:
         Compute fingerprint = hash(date + amount + normalizedDescription)
         If fingerprint matches any existing → classify as duplicate
         Else → classify as unique
```

---

## 11. AI / LLM Integration

### Tier Selection Logic (`ai-engine.js`)

```
isAvailable()
    ├─ getApiConfig() !== null  → return 'api'
    ├─ getEngine() !== null     → return 'webllm'
    └─ else                     → return 'rules'

complete(prompt, context)
    ├─ tier === 'api'    → callUserApi([{role:'system', content: context}, {role:'user', content: prompt}])
    ├─ tier === 'webllm' → generate(messages)
    └─ tier === 'rules'  → throw Error (chat unavailable)

analyze(question, financialData)
    → complete(question, `Context: ${JSON.stringify(financialData)}`)
```

### WebLLM Model Details

| Property | Value |
|---|---|
| Model ID | `gemma-2-2b-it-q4f16_1-MLC` |
| Quantization | 4-bit float16 |
| Format | MLC (Machine Learning Compilation) |
| Backend | WebGPU (via `@mlc-ai/web-llm`) |
| System Prompt | "You are FinTrack Pro, an AI financial assistant running locally on the user's device..." |
| Default max_tokens | 500 |
| Default temperature | 0.7 |
| Categorization max_tokens | 50 |
| Categorization temperature | 0.3 |

**WebGPU Requirement**: `navigator.gpu` must be defined. Chrome 113+ and Edge 113+ support this. Firefox and Safari have experimental support.

---

## 12. PWA & Service Worker

### manifest.json

```json
{
  "name": "FinTrack Pro",
  "short_name": "FinTrack",
  "display": "standalone",       // Hides browser chrome when installed
  "orientation": "any",
  "theme_color": "#0a0f1e",
  "background_color": "#0a0f1e",
  "start_url": "./",
  "scope": "./"
}
```

Icons are **inline SVG data URIs** — no external image files required.

### Service Worker (`sw.js`)

Built with **Workbox CDN** (no build step required for the SW itself):

| Cache Name | Strategy | Applies To |
|---|---|---|
| `fintrack-assets-v1` | StaleWhileRevalidate | HTML, CSS, JS files |
| `fintrack-images-v1` | CacheFirst | Images |
| (default) | NetworkFirst | Everything else |

**Precached on install**: `./`, `./index.html`, `./manifest.json`

**Cache expiration**:
- Assets: 30 days, max 100 entries
- Images: 30 days, max 50 entries

**Activation**: Calls `self.skipWaiting()` + `self.clients.claim()` for immediate takeover on update.

**Offline fallback**: The `NetworkFirst` default strategy means API calls (exchange rates) fail gracefully when offline — the currency service falls back to the IDB-cached rates.

---

## 13. Encryption

`src/crypto.js` provides AES-256-GCM encryption using the native **Web Crypto API** — no external library needed.

### Algorithm Details

| Property | Value |
|---|---|
| Algorithm | AES-GCM |
| Key Length | 256 bits |
| IV Length | 96 bits (12 bytes) |
| Key Derivation | PBKDF2 |
| PBKDF2 Hash | SHA-256 |
| PBKDF2 Iterations | 100,000 |
| Salt Length | 128 bits (16 bytes) |

### API

```js
import { encrypt, decrypt, deriveKey, generateSalt } from './crypto.js';

// Encrypt
const result = await encrypt(plaintextString, passphrase);
// result = { iv: base64, salt: base64, data: base64 }

// Decrypt
const plaintext = await decrypt({ iv, salt, data }, passphrase);

// Key derivation (if needed directly)
const salt = generateSalt();                     // → Uint8Array(16)
const key = await deriveKey(passphrase, salt);   // → CryptoKey
```

**Usage**: Used for encrypted backup export in the Settings module. The user provides a passphrase; all financial data is encrypted before being written to the export file.

---

## 14. CSS Architecture

### Global Design Tokens (`index.html` inline styles)

All colors, spacing, and layout dimensions are CSS custom properties defined in `:root` in `index.html`:

```css
:root {
  /* Background layers */
  --bg-primary:    #0a0f1e;   /* Page background */
  --bg-secondary:  #111827;   /* Sidebar, topbar */
  --bg-card:       #1a1f35;   /* Card surfaces */
  --bg-elevated:   #232a42;   /* Hover states, elevated cards */
  --border:        rgba(255, 255, 255, 0.06);
  --border-active: rgba(99, 102, 241, 0.5);

  /* Typography */
  --text-primary:   #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;

  /* Brand accent (indigo) */
  --accent:       #6366f1;
  --accent-light: #818cf8;
  --accent-glow:  rgba(99, 102, 241, 0.25);

  /* Semantic colors */
  --success: #22c55e;
  --warning: #f59e0b;
  --danger:  #ef4444;
  --info:    #3b82f6;

  /* Layout */
  --sidebar-w: 260px;
  --topbar-h:  64px;
  --radius:    12px;
  --radius-sm: 8px;
}
```

### Layout Structure (HTML)

```html
<div id="app-wrapper">           <!-- flex row, height: 100vh -->
  <aside id="sidebar"></aside>   <!-- 260px, filled by sidebar.js -->
  <div id="main-area">           <!-- flex column, flex: 1 -->
    <header id="topbar"></header><!-- 64px, filled by topbar.js -->
    <main id="app-content">      <!-- overflow-y: auto, flex: 1 -->
      <!-- Modules render here -->
    </main>
  </div>
</div>
```

### Responsive Breakpoint

At `max-width: 768px`:
- Sidebar becomes `position: fixed; transform: translateX(-100%)`
- Adding class `.open` slides it in
- This is toggled by the hamburger button in the topbar

### CSS Files

| File | Purpose |
|---|---|
| `tokens.css` | Additional CSS custom properties |
| `base.css` | Element resets, body defaults |
| `components.css` | Reusable `.card`, `.btn`, `.form-input`, `.badge`, `.modal` |
| `animations.css` | `@keyframes` definitions (fadeIn, slideUp, spin) |
| `sidebar.css` | Sidebar nav, active states, icons |
| `dashboard.css` | Dashboard grid layout |
| `onboarding.css` | Onboarding wizard layout |
| `themes.css` | `.theme-light` overrides |

Modules inject additional inline `<style>` tags into the document head as needed (pattern used for module-specific scoped styles).

---

## 15. Data Schemas

### Transaction

```js
{
  id: string,              // crypto.randomUUID()
  date: string,            // 'YYYY-MM-DD'
  description: string,     // Original transaction description
  amount: number,          // Positive number
  type: 'income' | 'expense' | 'transfer',
  category: string,        // Category name string
  accountId: string,       // Reference to accounts store
  currency: string,        // ISO 4217 (e.g., 'INR', 'USD')
  notes: string,
  tags: string[],
  isRecurring: boolean,
  recurrenceRule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number,      // Every N frequency units
    endDate: string | null // 'YYYY-MM-DD' or null (no end)
  } | null,
  importedFrom: string | null,  // Bank profile ID
  createdAt: string,       // ISO 8601
  updatedAt: string,       // ISO 8601
}
```

### Account

```js
{
  id: string,
  name: string,
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'wallet' | 'investment',
  currency: string,
  balance: number,
  color: string,           // Hex color for UI
  icon: string,            // Icon name from lucide
  isDefault: boolean,
  createdAt: string,
}
```

### Budget

```js
{
  id: string,
  name: string,
  category: string,
  amount: number,
  period: 'monthly' | 'yearly' | 'custom',
  startDate: string,
  endDate: string | null,
  rollover: boolean,       // Carry unused budget to next period
  currency: string,
  createdAt: string,
}
```

### Profile

```js
{
  id: string,
  name: string,
  type: 'individual' | 'corporate',
  currency: string,        // Default currency
  avatar: string | null,   // Base64 or emoji
  createdAt: string,
}
```

### Exchange Rate Cache

```js
// Stored in IDB 'exchangeRates' store, keyed by currency code
{
  currency: string,   // Base currency (key path)
  rates: object,      // { USD: 1.0, INR: 83.5, EUR: 0.92, ... }
  timestamp: number,  // Unix ms timestamp
}
```

---

## 16. Full Data Flow Diagrams

### Transaction Import Flow

```
User selects file (drag-drop or file picker)
        │
        ▼
modules/import/index.js
        │
        ├─ parseStatement(file)  ← parsers/index.js
        │       │
        │       ├─ Detect format (CSV/PDF/OFX)
        │       ├─ Detect bank profile
        │       ├─ Parse raw data → NormalizedTransaction[]
        │       └─ Deduplication → { unique[], duplicates[] }
        │
        ├─ Show preview UI (editable transaction list)
        │
        ├─ User confirms import
        │
        ├─ For each unique transaction:
        │     ├─ categorize(description) ← services/categorizer.js
        │     └─ add('transactions', tx) ← db.js
        │
        ├─ store.setState('transactions', updatedList)
        │
        └─ store.notify({ type: 'success', message: 'X transactions imported' })
```

### AI Categorization Flow

```
categorize(description, categories)
        │
        ├─ Tier 1: Check aiCache Map
        │     If found → return { category, confidence: 1.0, method: 'learned' }
        │
        ├─ Tier 2: ruleBasedCategorize(description)
        │     Lowercase match against MERCHANT_MAPPING
        │     Also try extractMerchantFromUPI() for UPI/NEFT/IMPS strings
        │     If found → return { category, confidence: 0.9, method: 'rules' }
        │
        └─ Tier 3: categorizeWithAI(description, categories)
                │
                ├─ if getApiConfig() → callUserApi(messages)
                │       POST to configured endpoint
                │       Parse JSON response: { category, confidence }
                │
                ├─ elif getEngine() → generate(messages, { max_tokens: 50, temperature: 0.3 })
                │       WebLLM inference on-device
                │       Parse JSON response
                │
                └─ else → { category: 'Uncategorized', confidence: 0 }
```

### Store Update → UI Reactivity Flow

```
db.add('transactions', newTx)         ← Persist to IndexedDB
        │
        ▼
store.setState('transactions', [...store.getState('transactions'), newTx])
        │
        ├─ Notifies all store.subscribe('transactions', cb) callbacks
        │
        └─ Each subscribed module updates its DOM:
             transactions/index.js → re-renders transaction list
             dashboard/index.js    → updates KPI cards
             budgets/index.js      → recalculates budget progress
             analytics/index.js    → updates charts
```

---

## 17. External APIs & Dependencies

| API / CDN | URL | Purpose | Fallback |
|---|---|---|---|
| Exchange Rate API | `https://open.er-api.com/v6/latest/{base}` | Live currency rates (free, no key) | IDB-cached rates |
| Google Fonts | `https://fonts.googleapis.com` | Inter font | System `-apple-system, BlinkMacSystemFont, Segoe UI` |
| Workbox CDN | `https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js` | Service Worker strategies | Basic fetch fallback |
| WebLLM model | Downloaded from MLC CDN on first use | Gemma 2B on-device inference | Rule-based categorization |
| User-configured LLM | Configured by user | AI chat + categorization | WebLLM or rules |

**No analytics, no tracking, no telemetry of any kind.**

---

## 18. Replicating This Infrastructure

Follow these steps to recreate the project infrastructure from scratch:

### Step 1: Initialize the Project

```bash
mkdir fintrack-pro && cd fintrack-pro
npm init -y
npm install --save-dev vite workbox-cli
```

### Step 2: Install Runtime Dependencies

```bash
npm install \
  idb \
  chart.js \
  @mlc-ai/web-llm \
  tesseract.js \
  papaparse \
  pdf-parse \
  jspdf \
  html2canvas \
  xlsx \
  lucide
```

### Step 3: Configure Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { open: true },
});
```

### Step 4: Create the App Shell (index.html)

Key requirements:
- Define all CSS custom properties in `:root` (design tokens)
- Structure: `#app-wrapper` > `#sidebar` + `#main-area` (`#topbar` + `#app-content`)
- Link `manifest.json`
- Load `src/main.js` as a module

### Step 5: Set Up IndexedDB

Copy `src/db.js` — the schema setup in `upgrade()` must list all object stores and indexes before any data access.

**Critical**: Define all object stores in the `upgrade()` callback in `openDB()`. Adding stores later requires a version bump.

### Step 6: Implement the Store

The store in `src/store.js` is fully self-contained. Copy it as-is. It only depends on `db.js` for settings persistence.

### Step 7: Implement the Router

Copy `src/router.js`. Register your routes with dynamic imports. Ensure each module exports `render(container)`.

### Step 8: Bootstrap in main.js

Copy the bootstrap sequence from `src/main.js`. The order matters:
1. `migrate()` first (handles legacy data)
2. Load data into store
3. Mount persistent UI (sidebar, topbar)
4. `initRouter()` last (triggers first render)
5. Register service worker after (non-blocking)

### Step 9: PWA Setup

```json
// manifest.json
{
  "name": "Your App",
  "display": "standalone",
  "start_url": "./",
  "scope": "./",
  "theme_color": "#...",
  "icons": [...]
}
```

```js
// sw.js — use Workbox CDN (no build step)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
// Register routes with strategies...
```

```html
<!-- index.html -->
<link rel="manifest" href="/manifest.json" />
```

### Step 10: Add Module Structure

For each route, create `src/modules/<name>/index.js` exporting `render(container)`. The router will dynamically import and call it.

### Minimum Viable Module

```js
// src/modules/example/index.js
import { store } from '../../store.js';

export function render(container) {
  container.innerHTML = `<h1>Example Page</h1>`;
}
```

---

## Summary: Architecture Decision Rationale

| Decision | Rationale |
|---|---|
| No framework (Vue/React/etc.) | Zero bundle overhead; direct DOM control; 100% learnable |
| Hash-based routing | Works on any static file host without server config |
| IndexedDB over localStorage | Supports large datasets, structured queries, async I/O |
| Pub/sub store over framework reactivity | Simple, predictable, zero dependencies |
| Dynamic imports for modules | Reduces initial load; each page is a separate chunk |
| Web Crypto API for encryption | Native, no external library, zero attack surface increase |
| Workbox from CDN in SW | Avoids build complexity for the service worker |
| On-device LLM (WebLLM) | Privacy-first AI without sending financial data to any server |
| 3-tier categorization | Instant response for known merchants; AI only when needed |
| 100% client-side | No infrastructure to maintain, no server costs, maximum privacy |
