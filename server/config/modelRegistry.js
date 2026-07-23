/**
 * config/modelRegistry.js — Centralized AI Model Registry
 *
 * Single source of truth for every AI model the platform supports.
 * Providers, plan access, pricing, and capabilities all live here.
 *
 * Rules:
 *  - 'enterprise' automatically receives every model where enabled === true.
 *  - requiredPlan is the MINIMUM plan needed; enterprise always inherits all.
 *  - disabled models (enabled: false) are never returned to any plan.
 *  - Cost fields are optional (undefined = unknown / not billed per-token).
 *
 * Adding a new model:
 *  1. Add an entry to MODEL_REGISTRY below.
 *  2. Set requiredPlan to the lowest plan that should have access.
 *  3. Set enabled: true when the provider implementation is ready.
 *  4. Nothing else needs to change — helpers derive everything from this table.
 */

'use strict';

// ── Plan hierarchy (index = rank; higher index = higher plan) ─────────────────
const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ModelConfig
 * @property {string}  id                          - Canonical model ID (passed to provider SDK)
 * @property {string}  displayName                 - Human-readable name shown in the UI
 * @property {string}  provider                    - Provider key matching AIProviderFactory registry
 * @property {string}  requiredPlan                - Minimum plan ('free'|'starter'|'pro'|'enterprise')
 * @property {boolean} supportsStreaming            - Whether the provider supports token streaming
 * @property {number}  contextWindow               - Max context window in tokens
 * @property {boolean} enabled                     - False = hidden from all plans (not yet implemented)
 * @property {number}  [inputCostPerMillionTokens]  - USD per 1M input tokens (omit if unknown)
 * @property {number}  [outputCostPerMillionTokens] - USD per 1M output tokens (omit if unknown)
 */

/** @type {ModelConfig[]} */
const MODEL_REGISTRY = [
  // ── Gemini ──────────────────────────────────────────────────────────────────
  {
    id:                          'gemini-1.5-flash',
    displayName:                 'Gemini 1.5 Flash',
    provider:                    'gemini',
    requiredPlan:                'free',
    supportsStreaming:            true,
    contextWindow:               1_000_000,
    enabled:                     true,
    inputCostPerMillionTokens:   0.075,
    outputCostPerMillionTokens:  0.30,
  },
  {
    id:                          'gemini-2.0-flash',
    displayName:                 'Gemini 2.0 Flash',
    provider:                    'gemini',
    requiredPlan:                'free',
    supportsStreaming:            true,
    contextWindow:               1_000_000,
    enabled:                     true,
    inputCostPerMillionTokens:   0.10,
    outputCostPerMillionTokens:  0.40,
  },

  // ── OpenAI ───────────────────────────────────────────────────────────────────
  {
    id:                          'gpt-4.1-mini',
    displayName:                 'GPT-4.1 Mini',
    provider:                    'openai',
    requiredPlan:                'starter',
    supportsStreaming:            true,
    contextWindow:               1_047_576,
    enabled:                     true,
    inputCostPerMillionTokens:   0.40,
    outputCostPerMillionTokens:  1.60,
  },
  {
    id:                          'gpt-4.1',
    displayName:                 'GPT-4.1',
    provider:                    'openai',
    requiredPlan:                'pro',
    supportsStreaming:            true,
    contextWindow:               1_047_576,
    enabled:                     true,
    inputCostPerMillionTokens:   2.00,
    outputCostPerMillionTokens:  8.00,
  },

  // ── Anthropic ───────────────────────────────────────────────────────────────────
  {
    id:                          'claude-sonnet-4',
    displayName:                 'Claude Sonnet 4',
    provider:                    'claude',
    requiredPlan:                'pro',
    supportsStreaming:            true,
    contextWindow:               200_000,
    enabled:                     true,
    inputCostPerMillionTokens:   3.00,
    outputCostPerMillionTokens:  15.00,
  },
];

// ── Internal lookup map (id → config) — built once at module load ─────────────
const _byId = new Map(MODEL_REGISTRY.map((m) => [m.id, m]));

// ── Helper: plan rank ─────────────────────────────────────────────────────────
const _rank = (plan) => PLAN_ORDER.indexOf(plan ?? 'free');

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * getModel(id) — look up a single model by its canonical ID.
 * Returns undefined when the ID is not in the registry.
 *
 * @param   {string} id
 * @returns {ModelConfig|undefined}
 */
function getModel(id) {
  return _byId.get(id);
}

/**
 * getModelsForPlan(plan) — return every enabled model accessible on a plan.
 * Enterprise receives all enabled models regardless of requiredPlan.
 *
 * @param   {string} plan
 * @returns {ModelConfig[]}
 */
function getModelsForPlan(plan) {
  const rank = _rank(plan);
  return MODEL_REGISTRY.filter((m) => {
    if (!m.enabled) return false;
    // Enterprise gets everything
    if (plan === 'enterprise') return true;
    return rank >= _rank(m.requiredPlan);
  });
}

/**
 * isModelAllowed(plan, modelId) — check whether a plan may use a specific model.
 *
 * @param   {string} plan
 * @param   {string} modelId
 * @returns {boolean}
 */
function isModelAllowed(plan, modelId) {
  const model = _byId.get(modelId);
  if (!model || !model.enabled) return false;
  if (plan === 'enterprise') return true;
  return _rank(plan) >= _rank(model.requiredPlan);
}

/**
 * getDefaultModel(plan) — return the best enabled model available for a plan.
 * "Best" = highest-ranked requiredPlan the plan can access.
 * Falls back to the first enabled model in the registry if nothing matches.
 *
 * @param   {string} plan
 * @returns {ModelConfig}
 */
function getDefaultModel(plan) {
  const available = getModelsForPlan(plan);
  if (available.length === 0) {
    // Safety net: should never happen while at least one model is enabled
    return MODEL_REGISTRY.find((m) => m.enabled) ?? MODEL_REGISTRY[0];
  }
  // Pick the model with the highest requiredPlan rank (most capable accessible model)
  return available.reduce((best, m) =>
    _rank(m.requiredPlan) > _rank(best.requiredPlan) ? m : best
  );
}

module.exports = {
  MODEL_REGISTRY,
  getModel,
  getModelsForPlan,
  isModelAllowed,
  getDefaultModel,
};
