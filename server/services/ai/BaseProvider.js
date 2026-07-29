/**
 * services/ai/BaseProvider.js
 *
 * Abstract base class for AI providers.
 * Every provider (Gemini, OpenAI, Claude, …) must extend this class
 * and implement generateReply() with the exact same signature and
 * return shape so callers never need to know which provider is active.
 */

class BaseProvider {
  /**
   * @param {string} name  Human-readable provider name used in logs / errors.
   */
  constructor(name) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly.');
    }
    this.name = name;
  }

  /**
   * Generate a reply from the AI model.
   *
   * @param {object[]} documents
   * @param {object[]} history     Prior messages [{ role, content }]
   * @param {string}   userMessage
   * @param {string}   companyName
   * @param {string}   [modelId]
   * @param {object}   [opts]
   * @param {string}   [opts.requestId]   - Correlation ID — propagate to all logs
   * @param {AbortSignal} [opts.signal]   - Fires on client disconnect
   * @param {number}   [opts.timeoutMs]   - Per-request timeout override
   *
   * @returns {Promise<{
   *   reply:   string,
   *   sources: object[],
   *   model:   string,
   *   usage: { inputTokens: number, outputTokens: number, totalTokens: number }
   * }>}
   */
  // eslint-disable-next-line no-unused-vars
  async generateReply(documents, history, userMessage, companyName, modelId, opts = {}) {
    throw new Error(`${this.name} must implement generateReply()`);
  }

  /**
   * Stream a reply token-by-token via an async generator.
   *
   * @param {object[]} documents
   * @param {object[]} history
   * @param {string}   userMessage
   * @param {string}   companyName
   * @param {string}   [modelId]
   * @param {object}   [opts]
   * @param {string}   [opts.requestId]   - Correlation ID
   * @param {AbortSignal} [opts.signal]   - Fires on client disconnect
   * @param {number}   [opts.timeoutMs]   - Per-request timeout override
   *
   * @yields {string} token chunk
   */
  // eslint-disable-next-line no-unused-vars
  async * generateStream(documents, history, userMessage, companyName, modelId, opts = {}) {
    throw new Error(`${this.name} must implement generateStream()`);
  }

  /**
   * Liveness check — returns 'healthy' or 'unhealthy'.
   * Default: 'healthy' (providers that cannot self-check inherit this).
   * Override in subclass to perform a real ping.
   *
   * @returns {Promise<'healthy'|'unhealthy'>}
   */
  async healthCheck() {
    return 'healthy';
  }
}

module.exports = BaseProvider;
