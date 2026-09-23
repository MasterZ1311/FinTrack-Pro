/**
 * FinTrack Pro — AI Engine Coordinator
 *
 * Coordinates between:
 * 1. Local-first WebLLM (Gemma 2B) running entirely in-browser.
 * 2. External API providers (Gemini, OpenAI, Groq, Anthropic) via user-api.
 * 3. Offline rule-based heuristic categorization.
 *
 * Privacy Guarantees:
 * - All financial context provided to AI is strictly filtered through createPrivacySafeSummary().
 * - In LOCAL_ONLY mode, external API tier is disabled.
 */

import { getEngine, generate, isWebGPUSupported } from './webllm-loader.js';
import { getApiConfig, callUserApi } from './user-api.js';
import { categorize } from './categorizer.js';
import { privacyManager } from './privacy-manager.js';
import { createPrivacySafeSummary } from './privacy-projection.js';

export function isAvailable() {
  if (privacyManager.isExternalAiAllowed() && getApiConfig()) {
    return 'api';
  }
  if (getEngine()) {
    return 'webllm';
  }
  return 'rules'; // Always available offline
}

export function getCapabilities() {
  const tier = isAvailable();
  if (tier === 'api' || tier === 'webllm') {
    return {
      chat: true,
      smartCategorization: true,
      insights: true,
      tier,
    };
  }
  return {
    chat: false,
    smartCategorization: false,
    insights: false,
    tier: 'rules',
  };
}

export async function complete(prompt, context = '') {
  const tier = isAvailable();
  const messages = [];

  if (context) {
    messages.push({ role: 'system', content: context });
  }
  messages.push({ role: 'user', content: prompt });

  if (tier === 'api') {
    return await callUserApi(messages);
  } else if (tier === 'webllm') {
    return await generate(messages);
  } else {
    if (privacyManager.isLocalOnly()) {
      throw new Error(
        'External AI is blocked in LOCAL_ONLY mode. Please run with local WebLLM or enable External AI in Settings.'
      );
    }
    throw new Error('AI Chat is not available. Please unlock your API credentials or load the local WebLLM engine.');
  }
}

export { categorize, isWebGPUSupported };

/**
 * Analyze financial queries using a privacy-safe financial summary projection.
 * Never passes raw transactions, account numbers, or PII.
 *
 * @param {string} question
 * @param {object} financialData - Raw financial entities { transactions, accounts, budgets, profile }
 * @returns {Promise<string>}
 */
export async function analyze(question, financialData) {
  const safeProjection = createPrivacySafeSummary(financialData);
  const context = `Privacy-Safe Financial Context: ${JSON.stringify(safeProjection)}`;
  return await complete(question, context);
}

export default {
  isAvailable,
  getCapabilities,
  complete,
  analyze,
  categorize,
};
