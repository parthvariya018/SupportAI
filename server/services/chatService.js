// server/services/chatService.js
// Orchestration only — no Express, no DB models, no provider details, no prompt logic.

'use strict';

const { randomUUID } = require('crypto');
const AppError       = require('../utils/AppError');

// ─── Validation ───────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['companyId', 'sessionId', 'userMessage', 'company'];

function validate(payload) {
  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) {
      throw new AppError(`chatService: missing required field "${field}"`, 400, 'INVALID_PAYLOAD');
    }
  }
  if (typeof payload.userMessage !== 'string' || !payload.userMessage.trim()) {
    throw new AppError('chatService: userMessage must be a non-empty string', 400, 'INVALID_MESSAGE');
  }
}

// ─── ChatService ──────────────────────────────────────────────────────────────
class ChatService {
  /**
   * @param {object} deps
   * @param {object} deps.historyService
   * @param {object} deps.contextService
   * @param {object} deps.promptService
   * @param {object} deps.AIProviderFactory
   * @param {object} [deps.usageService]
   * @param {object} [deps.logger]
   */
  constructor({ historyService, contextService, promptService, AIProviderFactory, usageService, logger }) {
    this.history  = historyService;
    this.context  = contextService;
    this.prompt   = promptService;
    this.factory  = AIProviderFactory;
    this.usage    = usageService  || null;
    this.log      = logger        || { info: () => {}, error: () => {} };
  }

  // ─── processMessage ─────────────────────────────────────────────────────────
  /**
   * Full chat turn: validate → history → context → prompt → AI → persist → return.
   *
   * @param {object} payload
   * @param {string} payload.companyId
   * @param {string} payload.sessionId
   * @param {string} payload.userMessage
   * @param {object} payload.company        - { name, systemPrompt?, instructions?, aiProvider?, modelId? }
   * @param {object} [payload.settings]     - forwarded to promptService
   * @param {object} [payload.historyOpts]  - forwarded to historyService.getHistory()
   *
   * @returns {Promise<{
   *   reply:         string,
   *   sources:       Array,
   *   usage:         object,
   *   model:         string,
   *   latency:       number,
   *   requestId:     string,
   * }>}
   */
  async processMessage(payload) {
    const requestId = randomUUID();
    const start     = Date.now();

    // 1. Validate
    validate(payload);
    const { companyId, sessionId, userMessage, company, settings, historyOpts } = payload;

    try {
      // 2. Load history + context in parallel
      const [historyResult, contextResult] = await Promise.all([
        this.history.getHistory(companyId, sessionId, historyOpts),
        this.context.buildContext(companyId),
      ]);

      // 3. Assemble prompt
      const { systemPrompt, userMessage: cleanMessage } = this.prompt.assemblePrompt({
        company,
        context:     contextResult,
        settings,
        userMessage,
      });

      // 4. Resolve provider
      const provider = this.factory.getProvider(company.modelId);

      // 5. Call provider
      const aiResponse = await provider.chat(
        systemPrompt,
        historyResult.messages,
        cleanMessage,
        { requestId }
      );

      const latency = Date.now() - start;

      // 6. Persist history (non-blocking — failure logged, not thrown)
      this.history.appendMessages(companyId, sessionId, cleanMessage, aiResponse.reply)
        .catch((err) => this.log.error(`[chatService] history persist failed | requestId=${requestId} | ${err.message}`));

      // 7. Persist usage (non-blocking)
      if (this.usage) {
        this.usage.record({
          companyId,
          sessionId,
          requestId,
          model:   aiResponse.model,
          usage:   aiResponse.usage,
          latency,
        }).catch((err) => this.log.error(`[chatService] usage persist failed | requestId=${requestId} | ${err.message}`));
      }

      this.log.info(`[chatService] ok | requestId=${requestId} | latency=${latency}ms | model=${aiResponse.model}`);

      // 8. Return provider-neutral response
      return {
        reply:     aiResponse.reply,
        sources:   contextResult.chunks.map(({ documentId, title, source, priority }) => ({ documentId, title, source, priority })),
        usage:     aiResponse.usage    || {},
        model:     aiResponse.model    || 'unknown',
        latency,
        requestId,
      };

    } catch (err) {
      const latency = Date.now() - start;
      this.log.error(`[chatService] failed | requestId=${requestId} | latency=${latency}ms | ${err.message}`);
      if (err instanceof AppError) throw err;
      throw new AppError('Chat processing failed', 500, 'CHAT_ERROR');
    }
  }
}

  // ─── processStreamMessage ────────────────────────────────────────────────────
  /**
   * Streaming chat turn: same pipeline as processMessage, but calls
   * provider.stream() and forwards chunks via callbacks.
   *
   * @param {object}   payload          - Same shape as processMessage
   * @param {AbortSignal} [payload.signal] - Fires on client disconnect
   * @param {object}   callbacks
   * @param {Function} callbacks.onChunk  - (text: string) => void
   * @param {Function} callbacks.onDone   - (meta: object) => void
   * @param {Function} callbacks.onError  - (err: Error)   => void
   */
  async processStreamMessage(payload, { onChunk, onDone, onError }) {
    const requestId = randomUUID();
    const start     = Date.now();

    try {
      validate(payload);
      const { companyId, sessionId, userMessage, company, settings, historyOpts, signal } = payload;

      const [historyResult, contextResult] = await Promise.all([
        this.history.getHistory(companyId, sessionId, historyOpts),
        this.context.buildContext(companyId),
      ]);

      const { systemPrompt, userMessage: cleanMessage } = this.prompt.assemblePrompt({
        company, context: contextResult, settings, userMessage,
      });

      const provider = this.factory.getProvider(company.modelId);

      // Accumulate full reply for history persistence
      let fullReply = '';

      await provider.stream(
        systemPrompt,
        historyResult.messages,
        cleanMessage,
        {
          onChunk: (text) => { fullReply += text; onChunk(text); },
          signal,
        }
      );

      const latency = Date.now() - start;

      // Persist history + usage non-blocking
      this.history.appendMessages(companyId, sessionId, cleanMessage, fullReply)
        .catch((err) => this.log.error(`[chatService] stream history persist failed | requestId=${requestId} | ${err.message}`));

      if (this.usage) {
        this.usage.record({ companyId, sessionId, requestId, model: company.modelId, latency })
          .catch((err) => this.log.error(`[chatService] stream usage persist failed | requestId=${requestId} | ${err.message}`));
      }

      this.log.info(`[chatService] stream ok | requestId=${requestId} | latency=${latency}ms`);
      onDone({ requestId, latency });

    } catch (err) {
      this.log.error(`[chatService] stream failed | requestId=${requestId} | ${err.message}`);
      onError(err instanceof AppError ? err : new AppError('Stream processing failed', 500, 'STREAM_ERROR'));
    }
  }
}

module.exports = ChatService;
