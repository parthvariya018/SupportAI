/**
 * services/geminiService.js — backward-compatibility shim
 *
 * This file preserves the original require() path used by chatController.js
 * and any other callers. All logic now lives in services/ai/GeminiProvider.js
 * and is routed through AIProviderFactory so the active provider can be
 * swapped via the AI_PROVIDER environment variable without touching callers.
 *
 * DO NOT add logic here. Extend BaseProvider instead.
 */

const { getProvider } = require('./ai/AIProviderFactory');

/**
 * generateReply — delegates to the active AI provider.
 * Signature and return shape are identical to the original implementation.
 */
const generateReply = (documents, history, userMessage, companyName, modelId) =>
  getProvider(modelId).generateReply(documents, history, userMessage, companyName, modelId);

/**
 * estimateTokens — kept as a named export because other modules may import it.
 * 1 token ≈ 4 characters (conservative estimate).
 */
const estimateTokens = (text) => Math.ceil((text || '').length / 4);

module.exports = { generateReply, estimateTokens };
