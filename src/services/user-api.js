/**
 * FinTrack Pro — External AI API Service
 *
 * Connects to user-configured AI providers (Gemini, OpenAI, Groq, Anthropic, Ollama).
 *
 * Security & Privacy:
 * 1. Credentials are never retrieved from plaintext localStorage; they are supplied by
 *    the Web Crypto credentialVault in IndexedDB.
 * 2. Outbound calls are guarded by networkGuard to enforce privacy policy (EXTERNAL_AI_ENABLED).
 * 3. Gemini API keys are sent via the `x-goog-api-key` header, not in query string URLs.
 * 4. All error messages are sanitized to scrub API keys, bearer tokens, and secrets.
 */

import { credentialVault } from './credential-vault.js';
import { guardFetch, canMakeRequest, PrivacyViolationError } from './network-guard.js';

export const PROVIDER_ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com',
  groq: 'https://api.groq.com',
  anthropic: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434',
};

/**
 * Save and encrypt API configuration into the credential vault.
 * @param {string} provider
 * @param {string} apiKey
 * @param {string} model
 * @param {string} passphrase
 * @returns {Promise<void>}
 */
export async function saveApiConfig(provider, apiKey, model, passphrase) {
  const config = { provider, apiKey, model };
  await credentialVault.storeCredentials('ai_config', config, passphrase);
}

/**
 * Get active decrypted API configuration if the vault is unlocked.
 * @returns {{ provider: string, apiKey: string, model: string } | null}
 */
export function getApiConfig() {
  return credentialVault.getCredentials('ai_config');
}

/**
 * Test the active API connection with a lightweight ping.
 * @returns {Promise<boolean>}
 */
export async function testApiConnection() {
  const config = getApiConfig();
  if (!config) return false;

  try {
    await callUserApi([{ role: 'user', content: 'Ping' }]);
    return true;
  } catch (err) {
    const safeError = credentialVault.scrubSensitive(err);
    console.warn('[API Service] Connection test failed:', safeError);
    return false;
  }
}

/**
 * Call the configured AI provider with conversation messages.
 * Enforces privacy mode check and data minimization.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 */
export async function callUserApi(messages) {
  const config = getApiConfig();
  if (!config) {
    throw new Error('No API credentials found. Please unlock the credential vault in Settings.');
  }

  const { provider, apiKey, model } = config;

  if (provider === 'ollama') {
    return callOllama(model, messages);
  }

  // Ensure external AI is permitted under the active privacy mode
  if (!canMakeRequest('ai_external', PROVIDER_ENDPOINTS[provider] || '')) {
    throw new PrivacyViolationError(
      'External AI request blocked: Privacy policy requires explicit enablement of EXTERNAL_AI_ENABLED mode.'
    );
  }

  try {
    if (provider === 'gemini') {
      return await callGemini(apiKey, model, messages);
    } else if (provider === 'openai') {
      return await callOpenAI(apiKey, model, messages);
    } else if (provider === 'groq') {
      return await callGroq(apiKey, model, messages);
    } else if (provider === 'anthropic') {
      return await callAnthropic(apiKey, model, messages);
    }
  } catch (err) {
    const scrubbedMsg = credentialVault.scrubSensitive(err.message || String(err));
    throw new Error(scrubbedMsg);
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function callGemini(apiKey, model = 'gemini-1.5-flash', messages) {
  // Use header-based authentication rather than leaking key in the URL query string
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const geminiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));

  const response = await guardFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents: geminiMessages }),
    },
    { category: 'ai_external', description: 'Gemini AI Completion' }
  );

  if (!response.ok) {
    throw new Error(`Gemini API Error: HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(apiKey, model = 'gpt-3.5-turbo', messages) {
  const url = `https://api.openai.com/v1/chat/completions`;
  const response = await guardFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    },
    { category: 'ai_external', description: 'OpenAI Completion' }
  );

  if (!response.ok) {
    throw new Error(`OpenAI API Error: HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callGroq(apiKey, model = 'llama3-8b-8192', messages) {
  const url = `https://api.groq.com/openai/v1/chat/completions`;
  const response = await guardFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    },
    { category: 'ai_external', description: 'Groq Completion' }
  );

  if (!response.ok) {
    throw new Error(`Groq API Error: HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey, model = 'claude-3-haiku-20240307', messages) {
  const url = `https://api.anthropic.com/v1/messages`;
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const response = await guardFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMsg ? systemMsg.content : '',
        messages: userMessages,
        max_tokens: 1024,
      }),
    },
    { category: 'ai_external', description: 'Anthropic Completion' }
  );

  if (!response.ok) {
    throw new Error(`Anthropic API Error: HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data?.content?.[0]?.text || '';
}

async function callOllama(model = 'llama3', messages) {
  const url = `http://localhost:11434/api/chat`;
  const response = await guardFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    },
    { category: 'local_service', description: 'Local Ollama Completion' }
  );

  if (!response.ok) {
    throw new Error(`Ollama API Error: HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data?.message?.content || '';
}

export default {
  saveApiConfig,
  getApiConfig,
  testApiConnection,
  callUserApi,
  PROVIDER_ENDPOINTS,
};
