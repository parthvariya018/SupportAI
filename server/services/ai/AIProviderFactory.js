/**
 * services/ai/AIProviderFactory.js
 *
 * Returns the correct AI provider instance for a given modelId.
 * Resolution order:
 *   1. modelId supplied → look up provider via modelRegistry.
 *   2. modelId omitted  → fall back to AI_PROVIDER env var.
 *   3. Neither set      → default to 'gemini'.
 *
 * Usage:
 *   const { getProvider } = require('./ai/AIProviderFactory');
 *   const ai = getProvider('gemini-2.5-flash'); // model-based
 *   const ai = getProvider();                   // env-var / default fallback
 *
 * Adding a new provider (e.g. OpenAI):
 *   1. Create services/ai/OpenAIProvider.js extending BaseProvider.
 *   2. Add a case 'openai' in the PROVIDERS map below.
 *   3. Register models with provider: 'openai' in modelRegistry — nothing else changes.
 */

const AppError = require('../../utils/AppError');
const { getModel } = require('../../config/modelRegistry');

// Registry maps provider key → lazy loader to avoid loading unused SDKs at startup
const PROVIDERS = {
  gemini: () => {
    const GeminiProvider = require('./GeminiProvider');
    return new GeminiProvider();
  },
  openai: () => {
    const OpenAIProvider = require('./OpenAIProvider');
    return new OpenAIProvider();
  },
  claude: () => {
    const ClaudeProvider = require('./ClaudeProvider');
    return new ClaudeProvider();
  },
};

const DEFAULT_PROVIDER = 'gemini';

// Singleton cache — one instance per provider key per process lifetime
const _instances = {};

/**
 * getProvider(modelId?) — returns the provider instance responsible for modelId.
 * When modelId is omitted, falls back to the AI_PROVIDER env var (default: gemini).
 *
 * @param   {string} [modelId]
 * @returns {import('./BaseProvider')}
 */
function getProvider(modelId) {
  // Resolve provider key: registry lookup → env var → hardcoded default
  let key;
  if (modelId) {
    const modelConfig = getModel(modelId);
    if (!modelConfig) {
      throw new AppError(
        `Model "${modelId}" not found in registry. Validate the modelId before calling getProvider().`,
        400
      );
    }
    key = modelConfig.provider;
  } else {
    key = (process.env.AI_PROVIDER || DEFAULT_PROVIDER).toLowerCase().trim();
  }

  if (!PROVIDERS[key]) {
    throw new AppError(
      `Unknown AI provider "${key}". Valid options: ${Object.keys(PROVIDERS).join(', ')}. ` +
      `Check AI_PROVIDER in .env.`,
      500
    );
  }

  if (!_instances[key]) {
    _instances[key] = PROVIDERS[key]();
    console.log(`[AIProviderFactory] Loaded provider: ${key}`);
  }

  return _instances[key];
}

module.exports = { getProvider };
