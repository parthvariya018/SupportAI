// server/providers/AIProviderFactory.js

const AppError        = require('../utils/AppError');
const { getModel }    = require('../config/modelRegistry');
const GeminiProvider  = require('./GeminiProvider');

/**
 * AIProviderFactory
 *
 * Responsibilities:
 *  1. Register provider instances at startup.
 *  2. Call validateConfig() on each provider — server fails fast if any key is missing.
 *  3. Resolve the correct provider instance for a given modelId at runtime.
 *
 * Does NOT:
 *  - Contain any business logic
 *  - Know about Express, MongoDB, or billing
 *  - Read environment variables directly (providers receive keys via constructor)
 */
class AIProviderFactory {
  /**
   * @param {object} logger - Injectable logger ({ info, error, warn })
   */
  constructor(logger = console) {
    this._providers = new Map(); // providerName -> provider instance
    this._logger    = logger;
  }

  /**
   * Registers a provider instance and immediately validates its configuration.
   * Throws AppError if validateConfig() fails — prevents silent misconfiguration.
   *
   * @param {BaseProvider} provider
   * @returns {Promise<void>}
   */
  async register(provider) {
    const name = provider.getName();

    try {
      await provider.validateConfig();
      this._providers.set(name, provider);
      this._logger.info?.(`[AIProviderFactory] registered provider: ${name}`);
    } catch (err) {
      this._logger.error?.(
        `[AIProviderFactory] failed to register provider "${name}": ${err.message}`
      );
      throw err; // never swallow — let server startup fail immediately
    }
  }

  /**
   * Resolves the correct provider instance for a given modelId.
   * Uses modelRegistry to determine which provider owns the model.
   * Throws AppError if the provider is not registered.
   *
   * @param {string} modelId
   * @returns {BaseProvider}
   */
  getProviderForModel(modelId) {
    const modelDef     = getModel(modelId); // throws if modelId unknown
    const providerName = modelDef.provider;
    const provider     = this._providers.get(providerName);

    if (!provider) {
      throw new AppError(
        `Provider "${providerName}" is not registered. ` +
        `Ensure it was initialised at startup.`,
        500,
        'PROVIDER_NOT_REGISTERED'
      );
    }

    return provider;
  }

  /**
   * Returns all currently registered provider names.
   * Useful for health check endpoints.
   * @returns {string[]}
   */
  getRegisteredProviders() {
    return Array.from(this._providers.keys());
  }
}

// ─── Factory initialisation ───────────────────────────────────────────────────

/**
 * Builds and returns a fully initialised AIProviderFactory.
 * Called once at server startup (server.js or app.js).
 *
 * Add future providers here — OpenAI, Claude, etc.
 * Each provider receives its API key via constructor injection, never process.env directly.
 *
 * @param {object} config  - { geminiApiKey, openaiApiKey, claudeApiKey, ... }
 * @param {object} logger  - Injectable logger
 * @returns {Promise<AIProviderFactory>}
 */
async function createProviderFactory(config, logger = console) {
  const factory = new AIProviderFactory(logger);

  // ── Gemini ────────────────────────────────────────────────────────────────
  if (config.geminiApiKey) {
    await factory.register(new GeminiProvider(config.geminiApiKey, logger));
  } else {
    logger.warn?.('[AIProviderFactory] GEMINI_API_KEY not provided — Gemini provider skipped');
  }

  // ── OpenAI (future) ───────────────────────────────────────────────────────
  // if (config.openaiApiKey) {
  //   const OpenAIProvider = require('./OpenAIProvider');
  //   await factory.register(new OpenAIProvider(config.openaiApiKey, logger));
  // }

  // ── Claude (future) ───────────────────────────────────────────────────────
  // if (config.claudeApiKey) {
  //   const ClaudeProvider = require('./ClaudeProvider');
  //   await factory.register(new ClaudeProvider(config.claudeApiKey, logger));
  // }

  logger.info?.(
    `[AIProviderFactory] initialised with providers: [${factory.getRegisteredProviders().join(', ')}]`
  );

  return factory;
}

module.exports = { AIProviderFactory, createProviderFactory };
