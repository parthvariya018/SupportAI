// server/services/promptService.js
// Pure function — no DB, no AI, no HTTP, no env vars, no side effects.

'use strict';

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULTS = Object.freeze({
  COMPANY_NAME:        'Support',
  FALLBACK_REPLY:      'I am sorry, I could not find relevant information to answer your question.',
  MAX_CONTEXT_CHUNKS:  10,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats context chunks into a readable block for the system prompt.
 * @param {Array<{ title: string, text: string, priority: string, language: string }>} chunks
 * @returns {string}
 */
function formatContextBlock(chunks) {
  if (!chunks || chunks.length === 0) return '';

  return chunks
    .slice(0, DEFAULTS.MAX_CONTEXT_CHUNKS)
    .map((chunk, i) =>
      `[Document ${i + 1}: ${chunk.title} | Priority: ${chunk.priority} | Lang: ${chunk.language}]\n${chunk.text}`
    )
    .join('\n\n---\n\n');
}

/**
 * Builds the system prompt from company + context.
 * @param {object} company   - { name, systemPrompt?, instructions? }
 * @param {object} context   - { chunks, metrics }
 * @param {object} [settings]- { fallbackReply?, tone? }
 * @returns {string}
 */
function buildSystemPrompt(company, context, settings = {}) {
  const companyName   = company?.name        || DEFAULTS.COMPANY_NAME;
  const instructions  = company?.systemPrompt || company?.instructions || '';
  const fallbackReply = settings?.fallbackReply || DEFAULTS.FALLBACK_REPLY;
  const contextBlock  = formatContextBlock(context?.chunks);

  const parts = [
    `You are a helpful customer support assistant for ${companyName}.`,
    `Always be polite, concise, and accurate.`,
    `If you do not know the answer, say: "${fallbackReply}"`,
  ];

  if (instructions) {
    parts.push(`\n## Company Instructions\n${instructions}`);
  }

  if (contextBlock) {
    parts.push(`\n## Knowledge Base\n${contextBlock}`);
  } else {
    parts.push(`\nNo documents are available. Answer only from general knowledge.`);
  }

  return parts.join('\n');
}

// ─── assemblePrompt ───────────────────────────────────────────────────────────
/**
 * Pure function. Assembles systemPrompt + userMessage from prepared data.
 *
 * @param {object} params
 * @param {object} params.company   - { name, systemPrompt?, instructions? }
 * @param {object} params.context   - { chunks: Array, metrics: object }
 * @param {object} [params.settings]- { fallbackReply?, tone? }
 * @param {string} params.userMessage
 *
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
function assemblePrompt({ company, context, settings = {}, userMessage }) {
  if (!userMessage || typeof userMessage !== 'string') {
    throw new TypeError('assemblePrompt: userMessage must be a non-empty string');
  }

  return {
    systemPrompt: buildSystemPrompt(company, context, settings),
    userMessage:  userMessage.trim(),
  };
}

module.exports = {
  assemblePrompt,
  buildSystemPrompt,
  formatContextBlock,
  DEFAULTS,
};
