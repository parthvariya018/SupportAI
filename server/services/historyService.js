// server/services/historyService.js

const Conversation = require('../models/Conversation');
const AppError     = require('../utils/AppError');

// ─── Constants ────────────────────────────────────────────────────────────────
const HISTORY_VERSION        = 1;   // increment on schema migration
const MAX_HISTORY_MESSAGES   = 20;  // default message-count trim limit
const VALID_ROLES            = new Set(['user', 'assistant', 'model']);

// MongoDB projection — never pull the full document
const MESSAGES_PROJECTION = { messages: 1, messageCount: 1, _id: 1 };

// ─── Role normalisation ───────────────────────────────────────────────────────
function normaliseRole(role) {
  if (role === 'user')                    return 'user';
  if (role === 'assistant' || role === 'model') return 'assistant';
  return null; // invalid — sanitizer will drop this message
}

// ─── sanitizeHistory ──────────────────────────────────────────────────────────
/**
 * Cleans raw DB messages before they reach any provider:
 *  - Drops messages with invalid/missing roles
 *  - Drops messages with empty or non-string content
 *  - Fixes consecutive same-role messages by dropping the duplicate
 *    (providers like Gemini require strict user/model alternation)
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Array<{ role: 'user'|'assistant', content: string }>}
 */
function sanitizeHistory(messages) {
  if (!Array.isArray(messages)) return [];

  const normalised = messages
    .filter((m) => VALID_ROLES.has(m.role) && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: normaliseRole(m.role), content: m.content.trim() }))
    .filter((m) => m.role !== null);

  // Remove consecutive duplicate roles — keep the last of each run
  const deduped = [];
  for (const msg of normalised) {
    if (deduped.length && deduped[deduped.length - 1].role === msg.role) {
      deduped[deduped.length - 1] = msg; // replace with latest
    } else {
      deduped.push(msg);
    }
  }

  return deduped;
}

// ─── trimHistory ─────────────────────────────────────────────────────────────
/**
 * Trims history to fit within limits and returns trim metrics.
 * Supports both message-count and token-count limits.
 * Token counting is provider-agnostic — caller passes an optional tokenCounter fn.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @param {object}   opts
 * @param {number}   [opts.maxMessages]    - Max message count (default: MAX_HISTORY_MESSAGES)
 * @param {number}   [opts.maxTokens]      - Max token budget (optional, future use)
 * @param {Function} [opts.tokenCounter]   - fn(message) => number, required if maxTokens set
 *
 * @returns {{ trimmed: Array, originalCount: number, sentCount: number, droppedCount: number }}
 */
function trimHistory(messages, opts = {}) {
  const { maxMessages = MAX_HISTORY_MESSAGES, maxTokens, tokenCounter } = opts;
  const originalCount = messages.length;

  let result = messages.slice(-maxMessages);

  // Token-based trimming — applied after message-count trim
  if (maxTokens && typeof tokenCounter === 'function') {
    let tokenTotal = 0;
    const tokenFit = [];
    for (let i = result.length - 1; i >= 0; i--) {
      const tokens = tokenCounter(result[i]);
      if (tokenTotal + tokens > maxTokens) break;
      tokenTotal += tokens;
      tokenFit.unshift(result[i]);
    }
    result = tokenFit;
  }

  // History must start with a 'user' message (Gemini requirement)
  const firstUserIndex = result.findIndex((m) => m.role === 'user');
  if (firstUserIndex > 0) result = result.slice(firstUserIndex);

  return {
    trimmed:       result,
    originalCount,
    sentCount:     result.length,
    droppedCount:  originalCount - result.length,
  };
}

// ─── getHistory ───────────────────────────────────────────────────────────────
/**
 * Fetches, sanitizes, and trims conversation history from MongoDB.
 * Returns a consistent HistoryResult object — never throws on missing conversation.
 *
 * @param {string} companyId
 * @param {string} sessionId
 * @param {object} [trimOpts]  - Passed directly to trimHistory()
 *
 * @returns {Promise<{
 *   messages:       Array<{ role: string, content: string }>,
 *   count:          number,
 *   trimmed:        boolean,
 *   droppedCount:   number,
 *   conversationId: string|null,
 *   historyVersion: number,
 * }>}
 */
async function getHistory(companyId, sessionId, trimOpts = {}) {
  try {
    const doc = await Conversation.findOne(
      { companyId, sessionId },
      MESSAGES_PROJECTION
    ).lean();

    if (!doc || !doc.messages?.length) {
      return {
        messages:       [],
        count:          0,
        trimmed:        false,
        droppedCount:   0,
        conversationId: null,
        historyVersion: HISTORY_VERSION,
      };
    }

    const sanitized = sanitizeHistory(doc.messages);
    const { trimmed, originalCount, sentCount, droppedCount } = trimHistory(sanitized, trimOpts);

    if (droppedCount > 0) {
      console.error(
        `[historyService] trimmed | companyId=${companyId} sessionId=${sessionId} ` +
        `original=${originalCount} sent=${sentCount} dropped=${droppedCount}`
      );
    }

    return {
      messages:       trimmed,
      count:          sentCount,
      trimmed:        droppedCount > 0,
      droppedCount,
      conversationId: doc._id.toString(),
      historyVersion: HISTORY_VERSION,
    };

  } catch (err) {
    console.error(`[historyService] getHistory failed | ${err.message}`);
    throw new AppError('Failed to fetch conversation history', 500, 'HISTORY_FETCH_ERROR');
  }
}

// ─── appendMessages ───────────────────────────────────────────────────────────
/**
 * Appends user + assistant messages to the conversation (upsert).
 * Accepts an optional Mongoose session for multi-document transactions
 * (usage events, billing, analytics can be saved in the same transaction).
 *
 * @param {string}          companyId
 * @param {string}          sessionId
 * @param {string}          userMessage
 * @param {string}          assistantReply
 * @param {object|null}     [mongoSession]  - Mongoose ClientSession for transactions
 *
 * @returns {Promise<void>}
 */
async function appendMessages(companyId, sessionId, userMessage, assistantReply, mongoSession = null) {
  try {
    const update = {
      $push: {
        messages: {
          $each: [
            { role: 'user',      content: userMessage    },
            { role: 'assistant', content: assistantReply },
          ],
        },
      },
      $inc:        { messageCount: 2 },
      $setOnInsert: {
        companyId,
        sessionId,
        historyVersion: HISTORY_VERSION,
      },
    };

    const queryOptions = { upsert: true, new: false };
    if (mongoSession) queryOptions.session = mongoSession;

    await Conversation.findOneAndUpdate({ companyId, sessionId }, update, queryOptions);

  } catch (err) {
    console.error(`[historyService] appendMessages failed | ${err.message}`);
    throw new AppError('Failed to save conversation messages', 500, 'HISTORY_SAVE_ERROR');
  }
}

// ─── getMessageCount ──────────────────────────────────────────────────────────
/**
 * Returns stored messageCount without loading messages array.
 * Used by ChatService to enforce per-session limits.
 *
 * @param {string} companyId
 * @param {string} sessionId
 * @returns {Promise<number>}
 */
async function getMessageCount(companyId, sessionId) {
  try {
    const doc = await Conversation.findOne(
      { companyId, sessionId },
      { messageCount: 1, _id: 0 }
    ).lean();

    return doc?.messageCount ?? 0;

  } catch (err) {
    console.error(`[historyService] getMessageCount failed | ${err.message}`);
    throw new AppError('Failed to fetch message count', 500, 'HISTORY_COUNT_ERROR');
  }
}

module.exports = {
  getHistory,
  appendMessages,
  getMessageCount,
  sanitizeHistory,
  trimHistory,
  MAX_HISTORY_MESSAGES,
  HISTORY_VERSION,
};
