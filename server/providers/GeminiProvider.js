// server/providers/GeminiProvider.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { randomUUID }          = require('crypto');
const BaseProvider             = require('./BaseProvider');
const AppError                 = require('../utils/AppError');
const { withRetry }            = require('../utils/retry');
const { PROVIDERS, getModel }  = require('../config/modelRegistry');

// ─── Role mapping ─────────────────────────────────────────────────────────────
const ROLE_MAP = Object.freeze({
  user:      'user',
  assistant: 'model',
  model:     'model',
});

/**
 * Converts provider-neutral history into Gemini's `contents` array format.
 * @param {Array<{ role: string, content: string }>} history
 * @returns {Array<{ role: string, parts: [{ text: string }] }>}
 */
function toGeminiHistory(history) {
  return history
    .filter((msg) => ROLE_MAP[msg.role])
    .map((msg) => ({
      role:  ROLE_MAP[msg.role],
      parts: [{ text: msg.content }],
    }));
}

/**
 * Extracts reply text from a Gemini response object.
 * @param {object} response - Raw Gemini SDK response
 * @returns {string}
 */
function extractText(response) {
  try {
    const text = response.response.text();
    if (!text || typeof text !== 'string') {
      throw new AppError('Gemini returned an empty response', 502, 'EMPTY_RESPONSE');
    }
    return text;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to parse Gemini response', 502, 'PARSE_ERROR', response);
  }
}

/**
 * Extracts token usage metadata from a Gemini response.
 * Returns null if usage data is unavailable — never throws.
 * @param {object} response
 * @returns {{ promptTokens: number, completionTokens: number, totalTokens: number } | null}
 */
function extractUsage(response) {
  try {
    const meta = response.response?.usageMetadata;
    if (!meta) return null;
    return {
      promptTokens:     meta.promptTokenCount     ?? 0,
      completionTokens: meta.candidatesTokenCount ?? 0,
      totalTokens:      meta.totalTokenCount      ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Wraps a Gemini SDK error into an AppError, preserving the full upstream body.
 * @param {Error} err
 * @returns {AppError}
 */
function wrapGeminiError(err) {
  if (err instanceof AppError) return err;
  const statusCode = err.status ?? err.statusCode ?? 502;
  const upstream   = {
    message:      err.message,
    status:       err.status      ?? null,
    errorDetails: err.errorDetails ?? null,
    stack:        err.stack,
  };
  return new AppError(err.message || 'Gemini API error', statusCode, 'GEMINI_API_ERROR', upstream);
}

// ─── GeminiProvider ───────────────────────────────────────────────────────────

class GeminiProvider extends BaseProvider {
  /**
   * @param {string}   apiKey  - Gemini API key (injected by AIProviderFactory)
   * @param {object}   logger  - Injectable logger ({ info, error, warn })
   */
  constructor(apiKey, logger = console) {
    super();
    this._apiKey = apiKey;
    this._logger = logger;
    this._client = null;
  }

  getName() {
    return PROVIDERS.GEMINI;
  }

  /**
   * Returns true if the provider supports systemInstruction for the given modelId.
   * All current Gemini models support it — this method exists for future-proofing.
   * @param {string} modelId
   * @returns {boolean}
   */
  supportsSystemInstruction(modelId) {
    const model = getModel(modelId);
    return model.provider === PROVIDERS.GEMINI;
  }

  /**
   * Validates API key, initialises SDK client, and runs a lightweight health check.
   * Called once at startup by AIProviderFactory.
   * Throws AppError with code 'MISSING_API_KEY' if key is absent.
   */
  async validateConfig() {
    if (!this._apiKey || typeof this._apiKey !== 'string') {
      throw new AppError('GEMINI_API_KEY is missing or invalid', 500, 'MISSING_API_KEY');
    }
    this._client = new GoogleGenerativeAI(this._apiKey);
    this._logger.info?.('[GeminiProvider] SDK client initialised');
  }

  /**
   * Builds a Gemini GenerativeModel instance.
   * generationConfig values come from modelRegistry — never hardcoded here.
   *
   * @param {string} modelId
   * @param {string} systemPrompt
   * @returns {GenerativeModel}
   */
  _getModel(modelId, systemPrompt) {
    const modelDef = getModel(modelId);

    const config = {
      model: modelId,
      generationConfig: {
        maxOutputTokens: modelDef.maxOutputTokens,
        ...(modelDef.temperature    !== undefined && { temperature:    modelDef.temperature }),
        ...(modelDef.topP           !== undefined && { topP:           modelDef.topP }),
        ...(modelDef.topK           !== undefined && { topK:           modelDef.topK }),
      },
    };

    if (systemPrompt && this.supportsSystemInstruction(modelId)) {
      config.systemInstruction = systemPrompt;
    }

    return this._client.getGenerativeModel(config);
  }

  /**
   * Sends a chat request and returns a provider-neutral result object.
   *
   * @param {object}      params
   * @param {string}      params.modelId
   * @param {string}      params.systemPrompt
   * @param {Array}       params.history       - Trimmed, provider-neutral history
   * @param {string}      params.userMessage
   * @param {AbortSignal} params.signal
   *
   * @returns {Promise<{ text: string, usage: object|null, model: string, latency: number, requestId: string }>}
   */
  async generateReply({ modelId, systemPrompt, history, userMessage, signal }) {
    const requestId = randomUUID();
    const startedAt = Date.now();

    this._logger.info?.(`[GeminiProvider] generateReply | requestId=${requestId} model=${modelId}`);

    try {
      const model    = this._getModel(modelId, systemPrompt);
      const chat     = model.startChat({ history: toGeminiHistory(history) });
      const response = await withRetry(
        (abortSignal) => chat.sendMessage(userMessage, { signal: abortSignal }),
        { maxRetries: 3, signal }
      );

      const text    = extractText(response);
      const usage   = extractUsage(response);
      const latency = Date.now() - startedAt;

      this._logger.info?.(
        `[GeminiProvider] success | requestId=${requestId} latency=${latency}ms tokens=${usage?.totalTokens ?? 'n/a'}`
      );

      return { text, usage, model: modelId, latency, requestId };

    } catch (err) {
      const latency = Date.now() - startedAt;
      this._logger.error?.(
        `[GeminiProvider] error | requestId=${requestId} latency=${latency}ms | ${err.message}`
      );
      throw wrapGeminiError(err);
    }
  }

  /**
   * Sends a streaming chat request and yields text chunks.
   * Streaming bypasses withRetry — partial chunks cannot be replayed safely.
   * Yields provider-neutral string chunks only.
   *
   * @param {object}      params
   * @param {string}      params.modelId
   * @param {string}      params.systemPrompt
   * @param {Array}       params.history
   * @param {string}      params.userMessage
   * @param {AbortSignal} params.signal
   *
   * @yields {string}
   */
  async *generateStream({ modelId, systemPrompt, history, userMessage, signal }) {
    const requestId = randomUUID();
    const startedAt = Date.now();

    this._logger.info?.(`[GeminiProvider] generateStream | requestId=${requestId} model=${modelId}`);

    try {
      const model  = this._getModel(modelId, systemPrompt);
      const chat   = model.startChat({ history: toGeminiHistory(history) });
      const result = await chat.sendMessageStream(userMessage, { signal });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }

      this._logger.info?.(
        `[GeminiProvider] stream complete | requestId=${requestId} latency=${Date.now() - startedAt}ms`
      );

    } catch (err) {
      this._logger.error?.(
        `[GeminiProvider] stream error | requestId=${requestId} | ${err.message}`
      );
      throw wrapGeminiError(err);
    }
  }
}

module.exports = GeminiProvider;
