// server/config/modelRegistry.js

// ─── Provider identifiers ────────────────────────────────────────────────────
const PROVIDERS = Object.freeze({
  GEMINI:  'gemini',
  OPENAI:  'openai',
  CLAUDE:  'claude',
});

// ─── Plan tiers ──────────────────────────────────────────────────────────────
const PLANS = Object.freeze({
  FREE:       'free',
  STARTER:    'starter',
  PRO:        'pro',
  ENTERPRISE: 'enterprise',
});

// Plan hierarchy — higher index = more access
const PLAN_ORDER = [PLANS.FREE, PLANS.STARTER, PLANS.PRO, PLANS.ENTERPRISE];

// ─── Model definitions ───────────────────────────────────────────────────────
// Each entry is the single source of truth for that model across the entire app.
const MODELS = Object.freeze({

  // ── Gemini ──────────────────────────────────────────────────────────────
  'gemini-2.5-flash': {
    provider:        PROVIDERS.GEMINI,
    displayName:     'Gemini 2.5 Flash',
    contextWindow:   1_000_000,
    maxOutputTokens: 8_192,
    streaming:       true,
    minimumPlan:     PLANS.FREE,
    enabled:         true,
  },

  'gemini-2.0-flash-lite': {
    provider:        PROVIDERS.GEMINI,
    displayName:     'Gemini 2.0 Flash Lite',
    contextWindow:   1_000_000,
    maxOutputTokens: 8_192,
    streaming:       true,
    minimumPlan:     PLANS.FREE,
    enabled:         true,
  },

  'gemini-2.0-flash': {
    provider:        PROVIDERS.GEMINI,
    displayName:     'Gemini 2.0 Flash',
    contextWindow:   1_000_000,
    maxOutputTokens: 8_192,
    streaming:       true,
    minimumPlan:     PLANS.FREE,
    enabled:         true,
  },

  'gemini-1.5-flash': {
    provider:        PROVIDERS.GEMINI,
    displayName:     'Gemini 1.5 Flash (deprecated)',
    contextWindow:   1_000_000,
    maxOutputTokens: 8_192,
    streaming:       true,
    minimumPlan:     PLANS.FREE,
    enabled:         false,
  },

  'gemini-1.5-pro': {
    provider:        PROVIDERS.GEMINI,
    displayName:     'Gemini 1.5 Pro (deprecated)',
    contextWindow:   2_000_000,
    maxOutputTokens: 8_192,
    streaming:       true,
    minimumPlan:     PLANS.PRO,
    enabled:         false,
  },

  // ── OpenAI (future) ──────────────────────────────────────────────────────
  'gpt-4o': {
    provider:        PROVIDERS.OPENAI,
    displayName:     'GPT-4o',
    contextWindow:   128_000,
    maxOutputTokens: 4_096,
    streaming:       true,
    minimumPlan:     PLANS.PRO,
    enabled:         false,   // flip to true when OpenAIProvider is wired
  },

  'gpt-4o-mini': {
    provider:        PROVIDERS.OPENAI,
    displayName:     'GPT-4o Mini',
    contextWindow:   128_000,
    maxOutputTokens: 4_096,
    streaming:       true,
    minimumPlan:     PLANS.STARTER,
    enabled:         false,
  },

  // ── Claude (future) ──────────────────────────────────────────────────────
  'claude-3-5-sonnet': {
    provider:        PROVIDERS.CLAUDE,
    displayName:     'Claude 3.5 Sonnet',
    contextWindow:   200_000,
    maxOutputTokens: 8_192,
    streaming:       true,
    minimumPlan:     PLANS.PRO,
    enabled:         false,   // flip to true when ClaudeProvider is wired
  },

  'claude-3-haiku': {
    provider:        PROVIDERS.CLAUDE,
    displayName:     'Claude 3 Haiku',
    contextWindow:   200_000,
    maxOutputTokens: 4_096,
    streaming:       true,
    minimumPlan:     PLANS.STARTER,
    enabled:         false,
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the model definition or throws a plain error (no AppError dependency here).
 * Callers that need AppError should use validateModel() instead.
 * @param {string} modelId
 * @returns {object}
 */
function getModel(modelId) {
  const model = MODELS[modelId];
  if (!model) throw new Error(`Unknown model: "${modelId}"`);
  return model;
}

/**
 * Returns true if the given plan meets the model's minimum plan requirement.
 * @param {string} plan     - Caller's current plan
 * @param {string} required - Model's minimumPlan
 * @returns {boolean}
 */
function planMeetsRequirement(plan, required) {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required);
}

/**
 * Full validation: model must exist, be enabled, and be accessible on the caller's plan.
 * Returns the model definition on success.
 * Throws AppError on failure — requires AppError to avoid circular deps at module load.
 *
 * @param {string} modelId
 * @param {string} callerPlan  - defaults to 'free' if omitted
 * @returns {object}           - model definition
 */
function validateModel(modelId, callerPlan = PLANS.FREE) {
  // Lazy-require to avoid circular dependency at module load time
  const AppError = require('../utils/AppError');

  if (!modelId || typeof modelId !== 'string') {
    throw new AppError('Model ID is required', 400, 'MISSING_MODEL');
  }

  const model = MODELS[modelId];

  if (!model) {
    throw new AppError(`Unknown model: "${modelId}"`, 400, 'INVALID_MODEL');
  }

  if (!model.enabled) {
    throw new AppError(
      `Model "${modelId}" is not yet available`,
      400,
      'MODEL_DISABLED'
    );
  }

  if (!planMeetsRequirement(callerPlan, model.minimumPlan)) {
    throw new AppError(
      `Model "${modelId}" requires the ${model.minimumPlan} plan or higher`,
      403,
      'PLAN_INSUFFICIENT'
    );
  }

  return model;
}

/**
 * Returns all enabled models, optionally filtered by provider.
 * @param {string} [provider]
 * @returns {Array<{ id: string, ...modelDef }>}
 */
function listModels(provider) {
  return Object.entries(MODELS)
    .filter(([, m]) => m.enabled && (!provider || m.provider === provider))
    .map(([id, m]) => ({ id, ...m }));
}

module.exports = {
  MODELS,
  PROVIDERS,
  PLANS,
  PLAN_ORDER,
  getModel,
  validateModel,
  listModels,
  planMeetsRequirement,
};
