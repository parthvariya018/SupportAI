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
   * @param {object[]} documents   Mongoose Document objects with extractedText
   * @param {object[]} history     Prior messages [{ role, content }]
   * @param {string}   userMessage Latest user message (raw — provider sanitizes)
   * @param {string}   companyName Used in the system prompt
   *
   * @returns {Promise<{
   *   reply:   string,
   *   sources: object[],
   *   model:   string,
   *   usage: {
   *     inputTokens:  number,
   *     outputTokens: number,
   *     totalTokens:  number,
   *   }
   * }>}
   */
  // eslint-disable-next-line no-unused-vars
  async generateReply(documents, history, userMessage, companyName, modelId) {
    throw new Error(`${this.name} must implement generateReply()`);
  }

  /**
   * Stream a reply token-by-token via an async generator.
   * Yields string chunks as they arrive, then returns the final metadata.
   *
   * @param {object[]} documents
   * @param {object[]} history
   * @param {string}   userMessage
   * @param {string}   companyName
   * @param {string}   modelId
   *
   * @yields {string} token chunk
   * @returns {Promise<{ sources: object[], model: string, usage: { inputTokens, outputTokens, totalTokens } }>}
   */
  // eslint-disable-next-line no-unused-vars
  async * generateStream(documents, history, userMessage, companyName, modelId) {
    throw new Error(`${this.name} must implement generateStream()`);
  }
}

module.exports = BaseProvider;
