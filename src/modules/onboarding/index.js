/**
 * FinTrack Pro — Onboarding Module Controller
 * Orchestrates the welcome screen and multi-step forms.
 * Checks for existing profile → skips onboarding if found.
 * On completion → saves profile to IndexedDB → redirects to #/dashboard.
 */

import { getAll, add } from '../../db.js';
import { store } from '../../store.js';
import { navigate } from '../../router.js';
import { renderWelcome } from './welcome.js';
import { renderIndividualForm } from './individual-form.js';
import { renderCorporateForm } from './corporate-form.js';
import { createIndividualProfile, createCorporateProfile } from './profile-schema.js';

// ─── CSS injection ─────────────────────────────────────────────────────────────

let cssInjected = false;

function injectStyles() {
  if (cssInjected) return;
  cssInjected = true;

  const style = document.createElement('style');
  style.id = 'ob-styles';
  style.textContent = `
    /* ════════════════════════════════════════════
       ONBOARDING — Core Layout
    ════════════════════════════════════════════ */

    .ob-welcome,
    .ob-form-wrapper {
      position: relative;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 24px 16px;
    }

    /* Animated background orbs */
    .ob-orb {
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(80px);
      opacity: 0.35;
      animation: ob-orb-float 8s ease-in-out infinite alternate;
    }
    .ob-orb-1 {
      width: 600px; height: 600px;
      background: radial-gradient(circle, #6366f1 0%, transparent 70%);
      top: -200px; left: -200px;
      animation-delay: 0s;
    }
    .ob-orb-2 {
      width: 500px; height: 500px;
      background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
      bottom: -150px; right: -150px;
      animation-delay: 3s;
    }
    .ob-orb-3 {
      width: 350px; height: 350px;
      background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: 6s;
    }

    @keyframes ob-orb-float {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(30px, 40px) scale(1.1); }
    }

    /* ════════════════════════════════════════════
       WELCOME SCREEN
    ════════════════════════════════════════════ */

    .ob-welcome-inner {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 760px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
    }

    /* Brand */
    .ob-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .ob-logo {
      width: 72px; height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.5);
      animation: ob-logo-pulse 3s ease-in-out infinite;
    }
    .ob-logo-icon { font-size: 2rem; }
    @keyframes ob-logo-pulse {
      0%, 100% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.5); }
      50% { box-shadow: 0 0 60px rgba(99, 102, 241, 0.8); }
    }
    .ob-brand-name {
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #f1f5f9;
    }
    .ob-brand-pro {
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Headline */
    .ob-headline { text-align: center; }
    .ob-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 12px;
    }
    .ob-subtitle {
      font-size: 1.0625rem;
      color: #94a3b8;
      max-width: 460px;
      line-height: 1.6;
    }

    /* Choice Cards */
    .ob-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      width: 100%;
    }
    @media (max-width: 640px) {
      .ob-cards { grid-template-columns: 1fr; }
    }

    .ob-card {
      position: relative;
      background: rgba(26, 31, 53, 0.8);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 20px;
      padding: 0;
      cursor: pointer;
      text-align: left;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.25s ease;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    .ob-card:hover,
    .ob-card.ob-card-hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .ob-card:focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
    }
    .ob-card.ob-card-selected {
      transform: scale(0.97);
      opacity: 0.7;
    }

    /* Gradient glow behind the card */
    .ob-card-glow {
      position: absolute;
      inset: -1px;
      border-radius: 20px;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 0;
      pointer-events: none;
    }
    .ob-card:hover .ob-card-glow { opacity: 1; }
    .ob-card-glow-indigo { background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15)); }
    .ob-card-glow-cyan { background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.15)); }

    .ob-card-inner {
      position: relative;
      z-index: 1;
      padding: 28px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
    }

    /* Icon */
    .ob-card-icon-wrap {
      width: 56px; height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }
    .ob-card-icon-indigo {
      background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15));
      border: 1px solid rgba(99,102,241,0.3);
    }
    .ob-card-icon-cyan {
      background: linear-gradient(135deg, rgba(6,182,212,0.25), rgba(16,185,129,0.15));
      border: 1px solid rgba(6,182,212,0.3);
    }
    .ob-card-icon { font-size: 1.75rem; }

    .ob-card-content { flex: 1; }
    .ob-card-title {
      font-size: 1.1875rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 6px;
    }
    .ob-card-desc {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .ob-card-features {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ob-card-features li {
      font-size: 0.8125rem;
      color: #cbd5e1;
    }

    .ob-card-arrow {
      position: absolute;
      top: 28px;
      right: 20px;
      color: #94a3b8;
      transition: transform 0.2s, color 0.2s;
    }
    .ob-card:hover .ob-card-arrow {
      transform: translateX(4px);
      color: #e2e8f0;
    }

    /* Gradient border */
    .ob-card-border {
      position: absolute;
      inset: 0;
      border-radius: 20px;
      padding: 1.5px;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .ob-card:hover .ob-card-border { opacity: 1; }
    .ob-card-border-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
    .ob-card-border-cyan { background: linear-gradient(135deg, #06b6d4, #10b981); }

    /* Trust bar */
    .ob-trust {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .ob-trust-item { font-size: 0.8125rem; color: #94a3b8; }
    .ob-trust-sep { color: #64748b; }

    /* ════════════════════════════════════════════
       FORM WRAPPER & PANEL
    ════════════════════════════════════════════ */

    .ob-form-panel {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 680px;
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 24px;
      padding: 36px 40px;
      backdrop-filter: blur(20px);
      box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
    }
    @media (max-width: 640px) {
      .ob-form-panel { padding: 24px 20px; border-radius: 20px; }
    }

    /* Back to welcome button */
    .ob-back-welcome {
      background: none;
      border: none;
      color: #64748b;
      font-size: 0.8125rem;
      cursor: pointer;
      padding: 0;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: color 0.2s;
      font-family: inherit;
    }
    .ob-back-welcome:hover { color: #94a3b8; }

    /* ════════════════════════════════════════════
       PROGRESS BAR & STEPS
    ════════════════════════════════════════════ */

    .ob-progress-header { margin-bottom: 32px; }

    .ob-progress-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .ob-profile-badge {
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 8px;
    }
    .ob-badge-individual {
      background: rgba(99,102,241,0.15);
      color: #818cf8;
      border: 1px solid rgba(99,102,241,0.25);
    }
    .ob-badge-corporate {
      background: rgba(6,182,212,0.15);
      color: #22d3ee;
      border: 1px solid rgba(6,182,212,0.25);
    }

    .ob-step-counter {
      font-size: 0.8125rem;
      color: #64748b;
    }

    .ob-progress-bar-track {
      height: 4px;
      background: rgba(255,255,255,0.06);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .ob-progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 2px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ob-progress-fill-cyan {
      background: linear-gradient(90deg, #06b6d4, #10b981);
    }

    .ob-progress-steps {
      display: flex;
      gap: 0;
    }
    .ob-prog-step {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    .ob-prog-step:not(:last-child)::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.08);
      margin: 0 8px;
    }
    .ob-prog-dot {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      flex-shrink: 0;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #64748b;
      transition: all 0.3s;
    }
    .ob-prog-step.ob-prog-active .ob-prog-dot {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-color: transparent;
      color: white;
      box-shadow: 0 0 16px rgba(99,102,241,0.5);
    }
    .ob-prog-step.ob-prog-done .ob-prog-dot {
      background: rgba(99,102,241,0.2);
      border-color: rgba(99,102,241,0.4);
      color: #818cf8;
    }
    .ob-prog-label {
      font-size: 0.75rem;
      color: #64748b;
      white-space: nowrap;
    }
    .ob-prog-step.ob-prog-active .ob-prog-label { color: #94a3b8; }

    /* ════════════════════════════════════════════
       STEP CONTENT & ANIMATIONS
    ════════════════════════════════════════════ */

    .ob-step-container { overflow: hidden; position: relative; }

    .ob-step-content {
      animation: none;
    }
    .ob-slide-in {
      animation: ob-slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .ob-slide-out-left {
      animation: ob-slideOutLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .ob-slide-out-right {
      animation: ob-slideOutRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    @keyframes ob-slideIn {
      from { opacity: 0; transform: translateX(30px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes ob-slideOutLeft {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(-30px); }
    }
    @keyframes ob-slideOutRight {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(30px); }
    }

    /* Step header */
    .ob-step-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .ob-step-emoji { font-size: 2.5rem; margin-bottom: 12px; }
    .ob-step-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    .ob-step-subtitle { font-size: 0.9375rem; color: #94a3b8; }

    /* ════════════════════════════════════════════
       FORM FIELDS
    ════════════════════════════════════════════ */

    .ob-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    @media (max-width: 540px) {
      .ob-form-grid { grid-template-columns: 1fr; }
    }

    .ob-field { display: flex; flex-direction: column; gap: 6px; }
    .ob-field-full { grid-column: 1 / -1; }

    .ob-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ob-required { color: #f87171; }
    .ob-optional { color: #475569; font-weight: 400; }

    .ob-input {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 11px 14px;
      color: #f1f5f9;
      font-family: inherit;
      font-size: 0.9375rem;
      width: 100%;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      outline: none;
      -webkit-appearance: none;
    }
    .ob-input::placeholder { color: #475569; }
    .ob-input:focus {
      border-color: rgba(99,102,241,0.6);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
      background: rgba(99,102,241,0.05);
    }
    .ob-input:hover:not(:focus) { border-color: rgba(255,255,255,0.15); }
    .ob-input.ob-input-error {
      border-color: rgba(239,68,68,0.6) !important;
      box-shadow: 0 0 0 3px rgba(239,68,68,0.15) !important;
    }

    /* Date input fix */
    input[type="date"].ob-input { color-scheme: dark; }

    /* Select */
    .ob-select-wrap { position: relative; }
    .ob-select {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 11px 36px 11px 14px;
      color: #f1f5f9;
      font-family: inherit;
      font-size: 0.9375rem;
      cursor: pointer;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ob-select:focus {
      border-color: rgba(99,102,241,0.6);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    .ob-select option { background: #1a1f35; }

    /* Field hint */
    .ob-field-hint { font-size: 0.75rem; color: #475569; }

    /* Error message */
    .ob-error-msg { font-size: 0.75rem; color: #f87171; margin-top: 2px; }

    /* Income range */
    .ob-income-display {
      margin-left: auto;
      font-size: 1.125rem;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ob-income-input { margin-top: 8px; }

    /* Range input */
    .ob-range {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: linear-gradient(90deg, #6366f1 0%, #6366f1 var(--pct, 50%), rgba(255,255,255,0.08) var(--pct, 50%), rgba(255,255,255,0.08) 100%);
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    .ob-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      box-shadow: 0 0 12px rgba(99,102,241,0.5);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .ob-range::-webkit-slider-thumb:hover {
      transform: scale(1.2);
      box-shadow: 0 0 20px rgba(99,102,241,0.7);
    }
    .ob-range::-moz-range-thumb {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      cursor: pointer;
    }

    .ob-range-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
    }
    .ob-range-labels span { font-size: 0.75rem; color: #475569; }

    /* Risk slider colors */
    .ob-risk-wrap { position: relative; }
    .ob-risk-label {
      margin-left: auto;
      font-size: 0.875rem;
      font-weight: 600;
      color: #94a3b8;
    }

    /* ════════════════════════════════════════════
       RADIO & CHECKBOX CARDS
    ════════════════════════════════════════════ */

    .ob-radio-cards,
    .ob-checkbox-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 10px;
    }
    .ob-radio-cards-sm {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    }

    .ob-radio-card,
    .ob-checkbox-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px 10px;
      border-radius: 12px;
      border: 1.5px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      min-height: 76px;
      justify-content: center;
    }
    .ob-radio-card input,
    .ob-checkbox-card input { display: none; }

    .ob-radio-card:hover,
    .ob-checkbox-card:hover {
      border-color: rgba(99,102,241,0.4);
      background: rgba(99,102,241,0.07);
    }
    .ob-radio-card-selected,
    .ob-checkbox-card-selected {
      border-color: #6366f1 !important;
      background: rgba(99,102,241,0.12) !important;
      box-shadow: 0 0 16px rgba(99,102,241,0.2);
    }
    .ob-radio-icon,
    .ob-checkbox-icon { font-size: 1.375rem; }
    .ob-radio-label,
    .ob-checkbox-label { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
    .ob-radio-card-selected .ob-radio-label,
    .ob-checkbox-card-selected .ob-checkbox-label { color: #818cf8; }

    /* ════════════════════════════════════════════
       THEME SELECTOR
    ════════════════════════════════════════════ */

    .ob-theme-cards {
      display: flex;
      gap: 12px;
    }
    .ob-theme-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 18px 12px;
      border-radius: 12px;
      border: 1.5px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }
    .ob-theme-card input { display: none; }
    .ob-theme-card:hover {
      border-color: rgba(99,102,241,0.4);
      background: rgba(99,102,241,0.07);
    }
    .ob-theme-card-selected {
      border-color: #6366f1 !important;
      background: rgba(99,102,241,0.12) !important;
      box-shadow: 0 0 16px rgba(99,102,241,0.2);
    }
    .ob-theme-icon { font-size: 1.5rem; }
    .ob-theme-label { font-size: 0.8125rem; color: #94a3b8; font-weight: 500; }
    .ob-theme-card-selected .ob-theme-label { color: #818cf8; }

    /* ════════════════════════════════════════════
       TOGGLES
    ════════════════════════════════════════════ */

    .ob-toggle-group {
      display: flex;
      flex-direction: column;
      gap: 1px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.06);
    }

    .ob-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 18px;
      background: rgba(255,255,255,0.02);
      transition: background 0.2s;
    }
    .ob-toggle-row:hover { background: rgba(255,255,255,0.04); }
    .ob-toggle-group .ob-toggle-row { border-radius: 0; }
    .ob-toggle-group .ob-toggle-row:first-child { border-radius: 14px 14px 0 0; }
    .ob-toggle-group .ob-toggle-row:last-child { border-radius: 0 0 14px 14px; }

    /* Standalone toggle row (outside group) */
    .ob-field-full > .ob-toggle-row {
      background: rgba(255,255,255,0.02);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.06);
      padding: 16px 18px;
    }

    .ob-toggle-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .ob-toggle-label { font-size: 0.9375rem; font-weight: 500; color: #f1f5f9; }
    .ob-toggle-desc { font-size: 0.8125rem; color: #64748b; }

    .ob-toggle {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 26px;
      flex-shrink: 0;
      cursor: pointer;
    }
    .ob-toggle input { display: none; }
    .ob-toggle-slider {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.1);
      border-radius: 13px;
      transition: background 0.3s;
    }
    .ob-toggle-slider::before {
      content: '';
      position: absolute;
      width: 20px; height: 20px;
      left: 3px; top: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .ob-toggle input:checked + .ob-toggle-slider {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    .ob-toggle input:checked + .ob-toggle-slider::before {
      transform: translateX(22px);
    }

    /* ════════════════════════════════════════════
       PHOTO UPLOAD
    ════════════════════════════════════════════ */

    .ob-photo-upload {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .ob-photo-preview {
      width: 72px; height: 72px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(99,102,241,0.3);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15));
    }
    .ob-photo-img { width: 100%; height: 100%; object-fit: cover; }
    .ob-photo-placeholder {
      font-size: 1.75rem;
      font-weight: 700;
      color: #6366f1;
    }
    .ob-photo-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    /* ════════════════════════════════════════════
       INPUT WITH PREFIX
    ════════════════════════════════════════════ */

    .ob-input-prefix-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .ob-input-prefix {
      position: absolute;
      left: 14px;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.9375rem;
      pointer-events: none;
      z-index: 1;
    }
    .ob-input-with-prefix { padding-left: 30px; }

    /* ════════════════════════════════════════════
       BUTTONS
    ════════════════════════════════════════════ */

    .ob-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 22px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .ob-btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      box-shadow: 0 4px 16px rgba(99,102,241,0.35);
    }
    .ob-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(99,102,241,0.5);
    }
    .ob-btn-primary:active { transform: translateY(0); }

    .ob-btn-cyan {
      background: linear-gradient(135deg, #06b6d4, #10b981) !important;
      box-shadow: 0 4px 16px rgba(6,182,212,0.35) !important;
    }
    .ob-btn-cyan:hover {
      box-shadow: 0 8px 24px rgba(6,182,212,0.5) !important;
    }

    .ob-btn-outline {
      background: transparent;
      color: #94a3b8;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .ob-btn-outline:hover {
      border-color: rgba(255,255,255,0.2);
      color: #f1f5f9;
      background: rgba(255,255,255,0.04);
    }

    .ob-btn-ghost {
      background: transparent;
      color: #64748b;
      border: none;
    }
    .ob-btn-ghost:hover { color: #94a3b8; }

    .ob-btn-sm { padding: 8px 14px; font-size: 0.875rem; }

    /* Form Nav */
    .ob-form-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .ob-nav-right { display: flex; align-items: center; gap: 10px; }

    /* ════════════════════════════════════════════
       CREATING ANIMATION
    ════════════════════════════════════════════ */

    .ob-creating {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 360px;
      gap: 32px;
      animation: ob-fadeIn 0.4s ease;
    }
    @keyframes ob-fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .ob-creating-animation {
      position: relative;
      width: 100px; height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ob-creating-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #6366f1;
      animation: ob-spin 1.2s linear infinite;
    }
    .ob-ring-2 {
      inset: 10px;
      border-top-color: #8b5cf6;
      animation-duration: 0.8s;
      animation-direction: reverse;
    }
    @keyframes ob-spin { to { transform: rotate(360deg); } }

    .ob-creating-icon {
      font-size: 2rem;
      animation: ob-bounce 1s ease-in-out infinite alternate;
    }
    @keyframes ob-bounce {
      from { transform: scale(0.9); }
      to { transform: scale(1.1); }
    }

    .ob-creating-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: #f1f5f9;
      text-align: center;
    }

    .ob-creating-steps {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 300px;
    }
    .ob-creating-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      font-size: 0.9375rem;
      color: #64748b;
      transition: all 0.3s;
    }
    .ob-creating-step.ob-cstep-done {
      border-color: rgba(99,102,241,0.3);
      background: rgba(99,102,241,0.07);
      color: #94a3b8;
    }
    .ob-cstep-check { font-size: 1.25rem; flex-shrink: 0; }

    /* ════════════════════════════════════════════
       FADE TRANSITIONS
    ════════════════════════════════════════════ */

    .ob-fade-enter {
      animation: ob-fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .ob-fade-exit {
      animation: ob-fadeOut 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    @keyframes ob-fadeOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.97); }
    }
  `;
  document.head.appendChild(style);
}

// ─── Onboarding Controller ─────────────────────────────────────────────────────

/** @type {HTMLElement|null} */
let _container = null;

/**
 * Show the welcome screen.
 */
function showWelcome() {
  renderWelcome(_container, (profileType) => {
    if (profileType === 'individual') {
      renderIndividualForm(
        _container,
        (formData) => completeOnboarding(formData, 'individual'),
        showWelcome
      );
    } else {
      renderCorporateForm(
        _container,
        (formData) => completeOnboarding(formData, 'corporate'),
        showWelcome
      );
    }
  });
}

/**
 * Save profile and redirect to dashboard.
 * @param {object} formData
 * @param {'individual'|'corporate'} type
 */
async function completeOnboarding(formData, type) {
  try {
    const profile =
      type === 'individual'
        ? createIndividualProfile(formData)
        : createCorporateProfile(formData);

    // Save to IndexedDB
    await add('profiles', profile);

    // Update store
    store.setState('profile', profile);

    console.log('[Onboarding] Profile saved:', profile.id);

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigate('#/dashboard');
    }, 600);
  } catch (err) {
    console.error('[Onboarding] Failed to save profile:', err);

    // Show a user-friendly error
    if (_container) {
      _container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:16px;text-align:center;">
          <p style="font-size:1.5rem;">😟</p>
          <h3 style="color:#f1f5f9;font-size:1.25rem;">Something went wrong</h3>
          <p style="color:#94a3b8;font-size:0.9375rem;">${err.message}</p>
          <button
            onclick="location.reload()"
            style="padding:10px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-size:0.9375rem;"
          >
            Try Again
          </button>
        </div>
      `;
    }
  }
}

// ─── Module API ────────────────────────────────────────────────────────────────

export default {
  async render(container) {
    _container = container;

    // Inject onboarding styles
    injectStyles();

    // Hide sidebar & topbar during onboarding for a fullscreen feel
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    if (sidebar) {
      sidebar.__obDisplay = sidebar.style.display;
      sidebar.style.display = 'none';
    }
    if (topbar) {
      topbar.__obDisplay = topbar.style.display;
      topbar.style.display = 'none';
    }

    // Remove app-content padding during onboarding
    container.style.padding = '0';
    container.style.overflow = 'auto';

    // Check if a profile already exists → skip onboarding
    try {
      const profiles = await getAll('profiles');
      if (profiles && profiles.length > 0) {
        console.log('[Onboarding] Profile already exists, skipping onboarding.');
        navigate('#/dashboard');
        return;
      }
    } catch (err) {
      console.warn('[Onboarding] Could not check profiles:', err);
    }

    showWelcome();
  },

  destroy() {
    // Restore sidebar & topbar
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    if (sidebar && sidebar.__obDisplay !== undefined) {
      sidebar.style.display = sidebar.__obDisplay;
    }
    if (topbar && topbar.__obDisplay !== undefined) {
      topbar.style.display = topbar.__obDisplay;
    }

    // Restore padding
    if (_container) {
      _container.style.padding = '';
      _container.style.overflow = '';
    }

    _container = null;
  },
};
