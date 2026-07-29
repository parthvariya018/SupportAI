// server/providers/BaseProvider.js

class BaseProvider {
  /**
   * Returns the provider identifier string.
   * Must match a key in PROVIDERS from modelRegistry.js.
   *
   * @returns {string}  e.g. 'gemini' | 'openai' | 'claude'
   */
  getName() {
    throw new Error(`${this.constructor.name} must implement getName()`);
  }

  /**
   * Validates that the provider is correctly configured (API key present, etc.).
   * Called once at startup by AIProviderFactory before registering the provider.
   * Should throw AppError with code 'MISSING_API_KEY' if config is invalid.
   *
   * @returns {void}
   */
  validateConfig() {
    throw new Error(`${this.constructor.name} must implement validateConfig()`);
  }

  /**
   * Sends a chat request and returns the full reply as a string.
   *
   * @param {object}      params
   * @param {string}      params.modelId      - Validated model ID from modelRegistry
   * @param {string}      params.systemPrompt - System/context prompt
   * @param {Array}       params.history      - Trimmed conversation history
   *                                           [{ role: 'user'|'model', content: string }]
   * @param {string}      params.userMessage  - Current user message
   * @param {AbortSignal} params.signal       - AbortController signal for timeout
   *
   * @returns {Promise<string>}  The assistant's reply text
   */
  async generateReply(params) {
    throw new Error(`${this.constructor.name} must implement generateReply()`);
  }

  /**
   * Sends a chat request and yields reply chunks as an async generator.
   * Each yielded value is a string chunk — not a full response object.
   * Used exclusively by the SSE streaming route.
   *
   * @param {object}      params              - Same shape as generateReply params
   * @param {string}      params.modelId
   * @param {string}      params.systemPrompt
   * @param {Array}       params.history
   * @param {string}      params.userMessage
   * @param {AbortSignal} params.signal
   *
   * @yields {string}  Text chunk from the stream
   */
  async *generateStream(params) {
    throw new Error(`${this.constructor.name} must implement generateStream()`);
  }
}

module.exports = BaseProvider;
