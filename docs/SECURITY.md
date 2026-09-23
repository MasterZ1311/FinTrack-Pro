# FinTrack Pro — Security Architecture & Threat Model

This document outlines the security architecture, cryptographic design, memory lifecycle, threat model, and network privacy enforcement for FinTrack Pro.

---

## 1. Executive Summary & Core Principles

FinTrack Pro is an open-source, client-first personal finance application. Unlike traditional finance management tools that aggregate banking credentials on remote servers, FinTrack Pro runs **100% client-side** in modern web browsers using Vanilla ES Modules, IndexedDB, and the standard Web Crypto API (`crypto.subtle`).

### Core Security Guarantees:
1. **Zero Server Custody**: All accounts, transactions, investments, and financial calculations are stored locally in the browser's IndexedDB. No backend database holds user balances.
2. **Encryption at Rest**: Sensitive API credentials and integration secrets are encrypted with **AES-256-GCM** using keys derived on demand via **PBKDF2 (100,000 rounds, SHA-256)**.
3. **No Hardcoded Master Secrets**: Encryption keys are derived strictly from a user-supplied passphrase. There is no static fallback key or backdoor in client source code.
4. **Secret Separation**: The decryption passphrase is never persisted to disk or stored next to encrypted ciphertexts.
5. **Truthful Privacy Modes**: The application defaults to `LOCAL_ONLY` mode with zero outbound network calls. External AI is strictly opt-in, bounded by aggregated, privacy-safe projections that strip all personal identifiers, account numbers, and transaction IDs.
6. **Leak-Proof Error Redaction**: API keys and authorization headers are never logged or exposed in unhandled error objects.

---

## 2. Threat Model for Client-Side Personal Finance

### 2.1 Asset Classification

| Asset | Sensitivity | Storage Location | Protection Mechanism |
|---|---|---|---|
| **AI Provider API Keys** (Gemini, OpenAI, Groq, Anthropic) | Critical | IndexedDB (`credentials` store) | AES-256-GCM encrypted with user passphrase |
| **Active Decrypted Key Material** | Critical | Memory (Module closure) / Tab `sessionStorage` | Wiped on lock or browser restart |
| **Financial Transactions & Balances** | High | IndexedDB (`transactions`, `accounts`) | Sandboxed to origin; never exported with credentials |
| **User Profile & Tax Identifiers** | High | IndexedDB (`profiles`) | Sandboxed to origin; stripped from AI context |
| **Imported Statements (CSV, PDF, OFX)** | High | Client memory / IndexedDB | Client-side parsing; zero remote uploads |

### 2.2 Adversary Profiles & Attack Vectors

#### Threat 1: Malicious Browser Extensions & Plaintext Storage Snooping
- **Attack Vector**: Rogue or compromised browser extensions inspect `localStorage` for API tokens (`fintrack_api_config`, `ai_api_key`).
- **Mitigation**: FinTrack Pro completely prohibits plaintext credentials in `localStorage`. All secrets are encrypted in IndexedDB using Web Crypto AES-256-GCM. An extension reading storage only retrieves high-entropy ciphertext with random salt and IV.

#### Threat 2: Shoulder Surfing & Physical Device Access
- **Attack Vector**: An adversary accesses an unlocked device or inspects developer tools.
- **Mitigation**: Passphrases are never written to disk. The user can lock the credential vault instantly (`Lock Vault`), which purges all decrypted keys from memory and `sessionStorage`. On browser restart, the vault is locked by default.

#### Threat 3: Data Exfiltration via Third-Party AI Integrations
- **Attack Vector**: An AI service prompts or logs raw user transactions, capturing bank account numbers, credit card numbers, UTRs, and notes.
- **Mitigation**: FinTrack Pro implements a **Privacy-Safe Financial Summary Projection** (`createPrivacySafeSummary`). Raw transactions and accounts are never serialized or transmitted. The AI receives only aggregated monthly totals, category allocations, budget utilization percentages, and savings rates. Bank account numbers, card numbers, UTRs, IDs, and raw notes are stripped.

#### Threat 4: Credential Leakage via Network Logs & URLs
- **Attack Vector**: API keys passed in URL query strings (e.g. `?key=AIzaSy...`) are recorded in browser history, proxy access logs, referrers, and network exception messages.
- **Mitigation**: Google Gemini requests use the `x-goog-api-key` header rather than URL query parameters. All network error handlers pass errors through `credentialVault.scrubSensitive()` to redact any detected keys or Bearer tokens.

#### Threat 5: Data Exposure via Unprotected Backups
- **Attack Vector**: A user exports their financial data (`fintrack-export-*.json`) and syncs it to cloud drives or emails it.
- **Mitigation**: The backup export pipeline strictly excludes the `credentials` store, API keys, and passphrases. Financial records can be safely archived without exporting live API secrets.

---

## 3. Cryptographic Architecture

### 3.1 Encryption at Rest (AES-256-GCM)
All persistent credentials are encrypted using the authenticated symmetric cipher **AES-256-GCM**:
- **Cipher**: AES-GCM (Galois/Counter Mode).
- **Key Length**: 256 bits.
- **Initialization Vector (IV)**: 96 bits (12 bytes), generated freshly for every encryption operation using `crypto.getRandomValues(new Uint8Array(12))`. An IV is never reused.
- **Authentication Tag**: 128-bit authentication tag appended by the Web Crypto implementation, providing confidentiality and integrity.

### 3.2 Key Derivation Function (PBKDF2)
- **Algorithm**: PBKDF2 (Password-Based Key Derivation Function 2) with HMAC-SHA-256.
- **Iteration Count**: `100,000` iterations (meeting OWASP recommendations for browser-based key derivation).
- **Salt**: 128 bits (16 bytes) generated freshly for each record via `crypto.getRandomValues(new Uint8Array(16))`.
- **Derived Key**: Non-extractable Web Crypto `CryptoKey` object configured for `['encrypt', 'decrypt']`.

### 3.3 Storage Record Format (IndexedDB `credentials` store)
```json
{
  "id": "ai_config",
  "version": 1,
  "salt": "base64-encoded-16-bytes",
  "iv": "base64-encoded-12-bytes",
  "data": "base64-encoded-ciphertext-and-tag",
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "updatedAt": "2026-09-22T21:00:00.000Z"
}
```
*Note: Neither the user's passphrase nor the derived encryption key is stored in the database.*

---

## 4. Memory Lifecycle & Session Boundaries

```
[User Passphrase] 
       │
       ▼ (PBKDF2, 100k rounds)
[CryptoKey in Memory] ──► [Decrypted Credentials in Memory Map]
                                   │
                                   ▼ (Active Tab Session Only)
                         [sessionStorage Cache]
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       ▼                                                       ▼
[Page Reload (F5)]                                    [Browser Restart / Tab Close]
Rehydrates memory map from sessionStorage             sessionStorage is destroyed by browser engine
Vault remains UNLOCKED                                Vault resets to LOCKED (requires Passphrase)
```

1. **Active Context**: While unlocked, decrypted credentials exist in a private `Map` scoped inside the `CredentialVault` closure.
2. **Page Reload (`F5`)**: To maintain a seamless user experience during development and navigation, active credentials are saved in tab-scoped `sessionStorage`. On reload, `credentialVault.init()` restores the in-memory cache without prompting.
3. **Browser Restart / New Tab**: `sessionStorage` is ephemeral and scoped to the browsing context. When the browser or tab is closed, the session is purged. On relaunch, the vault begins in `LOCKED` state.
4. **Immediate Lock**: Triggering `credentialVault.lock()` wipes the in-memory `Map` and purges `sessionStorage`.

---

## 5. Network Privacy & Data Minimization

FinTrack Pro enforces three truthful privacy modes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRIVACY MODES                                 │
├──────────────────────┬────────────────────────┬────────────────────────┤
│     LOCAL_ONLY       │    PRIVACY_ENHANCED    │  EXTERNAL_AI_ENABLED   │
│      (Default)       │                        │       (Opt-in)         │
├──────────────────────┼────────────────────────┼────────────────────────┤
│ • 100% Offline       │ • Exchange rates fetch │ • Exchange rates fetch │
│ • Remote AI blocked  │   (currency code only) │ • External AI enabled  │
│ • Remote rates       │ • Remote AI blocked    │ • Sanitized summary    │
│   blocked            │ • Local WebLLM allowed │   projection only      │
│ • Local WebLLM/rules │                        │ • Raw records blocked  │
└──────────────────────┴────────────────────────┴────────────────────────┘
```

### 5.1 Privacy-Safe Summary Projection Protocol
When `EXTERNAL_AI_ENABLED` is active, queries sent to external providers (Gemini, OpenAI, Anthropic, Groq) **never** serialize raw transactions. The `createPrivacySafeSummary()` generator constructs a minimal projection:
- **Excluded**:
  - Bank account numbers, IFSC, routing numbers, and card numbers.
  - UTR, IMPS, NEFT, UPI reference numbers.
  - Transaction IDs and account primary keys.
  - User names, company registration numbers, PAN, GSTIN.
  - Raw memo/notes text.
- **Included**:
  - Period label (e.g. "September 2026").
  - Aggregated monthly totals (income, expenses, net savings, savings rate %).
  - Top 5 expense categories with total and percentage share.
  - Budget envelope utilization percentages.

---

## 6. Legacy Plaintext Migration Protocol

When upgrading from earlier versions that stored API keys in `localStorage`:
1. `credentialVault.hasLegacyPlaintextCredentials()` detects the presence of `fintrack_api_config` or `ai_api_key`.
2. The application presents an explicit banner in Settings: **"Plaintext API Key Detected in Browser Storage"**.
3. The user is prompted to enter a vault passphrase to encrypt and migrate the key into IndexedDB, or click **"Discard"**.
4. Upon successful encryption, `credentialVault.discardLegacyCredentials()` deletes all plaintext keys from `localStorage`.
5. The application never silently guesses a master key or performs automatic unauthenticated migrations.

---

## 7. Verification & Security Testing Standards

FinTrack Pro maintains automated security tests covering:
- Roundtrip AES-256-GCM encryption and decryption.
- Rejection of invalid passphrases (`InvalidPassphraseError`).
- Rejection of tampered or corrupted ciphertext (`CorruptedCiphertextError`).
- Clean handling of missing or deleted credentials.
- Verification of tab-session rehydration on page reload.
- Verification of lock state on simulated browser restart.
- Verification of zero credentials in backup/export payloads.
- Fetch/XHR interception confirming zero outbound requests in `LOCAL_ONLY` mode.
- Verification that outgoing AI request payloads contain zero card numbers, account numbers, or UTRs.
