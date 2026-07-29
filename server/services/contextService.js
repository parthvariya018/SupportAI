// server/services/contextService.js

const Document = require('../models/Document');
const AppError  = require('../utils/AppError');

// ─── Context limits ───────────────────────────────────────────────────────────
const CONTEXT_LIMITS = Object.freeze({
  MAX_CHARS_PER_DOCUMENT: 8_000,
  MAX_TOTAL_CHARS:        24_000,
  MAX_DOCUMENTS:          10,
});

// ─── Document priority ────────────────────────────────────────────────────────
// Keywords matched against originalName (lowercase). Higher = loaded first.
const PRIORITY_RULES = [
  { keywords: ['faq', 'frequently'],          priority: 'high',   score: 3 },
  { keywords: ['product', 'pricing', 'plan'],  priority: 'high',   score: 3 },
  { keywords: ['policy', 'policies', 'terms'], priority: 'medium', score: 2 },
  { keywords: ['guide', 'manual', 'support'],  priority: 'medium', score: 2 },
  { keywords: ['blog', 'article', 'news'],     priority: 'low',    score: 1 },
];
const DEFAULT_PRIORITY = { priority: 'medium', score: 2 };

// ─── Simple in-process context cache ─────────────────────────────────────────
// Key: companyId + latest updatedAt timestamp string
// Evicted on next buildContext() call if key changes (documents updated/added)
const _cache = new Map();
const CACHE_MAX_SIZE = 50; // prevent unbounded growth

// ─── MongoDB projection ───────────────────────────────────────────────────────
const DOCUMENT_PROJECTION = {
  _id:           1,
  originalName:  1,
  extractedText: 1,
  charCount:     1,
  updatedAt:     1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Assigns a priority score to a document based on its filename.
 * @param {string} name - originalName
 * @returns {{ priority: string, score: number }}
 */
function resolvePriority(name) {
  const lower = name.toLowerCase();
  for (const rule of PRIORITY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { priority: rule.priority, score: rule.score };
    }
  }
  return DEFAULT_PRIORITY;
}

/**
 * Lightweight language detection based on Unicode character ranges.
 * Returns 'hi' (Hindi/Devanagari), 'gu' (Gujarati), or 'en' (default).
 * No external library — pure regex, zero dependencies.
 *
 * @param {string} text
 * @returns {'hi' | 'gu' | 'en' | 'mixed'}
 */
function detectLanguage(text) {
  const sample = text.slice(0, 500);
  const hasDevanagari = /[\u0900-\u097F]/.test(sample);
  const hasGujarati   = /[\u0A80-\u0AFF]/.test(sample);
  const hasLatin      = /[a-zA-Z]{3,}/.test(sample);

  if (hasDevanagari && hasLatin) return 'mixed';
  if (hasGujarati   && hasLatin) return 'mixed';
  if (hasDevanagari)             return 'hi';
  if (hasGujarati)               return 'gu';
  return 'en';
}

/**
 * Cleans raw extracted PDF text.
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[^\x20-\x7E\u0900-\u097F\u0A80-\u0AFF\n\r\t]/g, ' ') // keep Devanagari + Gujarati
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Truncates text to maxChars at the last whitespace boundary.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function truncateAtBoundary(text, maxChars) {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(' ', maxChars);
  return cut > 0 ? text.slice(0, cut) : text.slice(0, maxChars);
}

/**
 * Removes near-duplicate documents using a cheap text fingerprint.
 * @param {Array} docs
 * @returns {Array}
 */
function deduplicateDocs(docs) {
  const seen = new Set();
  return docs.filter((doc) => {
    const fp = doc.text.slice(0, 200).toLowerCase().replace(/\s+/g, '');
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

/**
 * Builds a cache key from companyId and the latest document updatedAt timestamp.
 * @param {string} companyId
 * @param {Array}  docs       - Raw MongoDB documents
 * @returns {string}
 */
function buildCacheKey(companyId, docs) {
  const latest = docs.reduce((max, d) => {
    const t = new Date(d.updatedAt).getTime();
    return t > max ? t : max;
  }, 0);
  return `${companyId}:${latest}`;
}

// ─── buildContext ─────────────────────────────────────────────────────────────
/**
 * Loads company documents, cleans, deduplicates, prioritises, and applies
 * context limits. Returns a provider-neutral context object with RAG-ready
 * metadata and full context metrics.
 *
 * No prompt generation. No provider imports. No role mapping.
 *
 * @param {string} companyId
 * @param {object} [opts]
 * @param {number} [opts.maxCharsPerDoc]
 * @param {number} [opts.maxTotalChars]
 * @param {number} [opts.maxDocuments]
 * @param {boolean}[opts.bypassCache]    - Force fresh DB read
 *
 * @returns {Promise<{
 *   chunks: Array<{
 *     documentId: string,
 *     title:      string,
 *     source:     string,
 *     text:       string,
 *     priority:   string,
 *     language:   string,
 *     chunkIndex: number,
 *   }>,
 *   metrics: {
 *     totalDocuments:   number,
 *     usedDocuments:    number,
 *     skippedDocuments: number,
 *     totalChars:       number,
 *     truncated:        boolean,
 *   },
 * }>}
 */
async function buildContext(companyId, opts = {}) {
  const maxCharsPerDoc = opts.maxCharsPerDoc ?? CONTEXT_LIMITS.MAX_CHARS_PER_DOCUMENT;
  const maxTotalChars  = opts.maxTotalChars  ?? CONTEXT_LIMITS.MAX_TOTAL_CHARS;
  const maxDocuments   = opts.maxDocuments   ?? CONTEXT_LIMITS.MAX_DOCUMENTS;

  try {
    const rawDocs = await Document.find(
      { companyId },
      DOCUMENT_PROJECTION
    ).sort({ createdAt: -1 }).limit(maxDocuments).lean();

    if (!rawDocs.length) {
      return {
        chunks:  [],
        metrics: { totalDocuments: 0, usedDocuments: 0, skippedDocuments: 0, totalChars: 0, truncated: false },
      };
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = buildCacheKey(companyId, rawDocs);
    if (!opts.bypassCache && _cache.has(cacheKey)) {
      return _cache.get(cacheKey);
    }

    // ── Clean + shape ────────────────────────────────────────────────────────
    const shaped = rawDocs
      .map((doc) => {
        const text = cleanText(doc.extractedText);
        if (!text) return null;
        const { priority, score } = resolvePriority(doc.originalName);
        return {
          documentId: doc._id.toString(),
          title:      doc.originalName,
          source:     doc.originalName,
          text,
          priority,
          score,
          language:   detectLanguage(text),
          chunkIndex: 0,
        };
      })
      .filter(Boolean);

    const totalDocuments = shaped.length;

    // ── Deduplicate ──────────────────────────────────────────────────────────
    const unique = deduplicateDocs(shaped);

    // ── Sort by priority score (high first) ──────────────────────────────────
    unique.sort((a, b) => b.score - a.score);

    // ── Apply per-doc char cap ───────────────────────────────────────────────
    const capped = unique.map((doc) => ({
      ...doc,
      text: truncateAtBoundary(doc.text, maxCharsPerDoc),
    }));

    // ── Apply total char budget (greedy, priority-ordered) ───────────────────
    let totalChars = 0;
    let truncated  = false;
    const chunks   = [];

    for (const doc of capped) {
      const remaining = maxTotalChars - totalChars;
      if (remaining <= 0) { truncated = true; break; }

      if (doc.text.length > remaining) {
        const { score, ...rest } = doc; // drop internal score from output
        chunks.push({ ...rest, text: truncateAtBoundary(doc.text, remaining) });
        totalChars += remaining;
        truncated   = true;
        break;
      }

      const { score, ...rest } = doc;
      chunks.push(rest);
      totalChars += doc.text.length;
    }

    const result = {
      chunks,
      metrics: {
        totalDocuments,
        usedDocuments:    chunks.length,
        skippedDocuments: totalDocuments - chunks.length,
        totalChars,
        truncated,
      },
    };

    // ── Cache result ─────────────────────────────────────────────────────────
    if (_cache.size >= CACHE_MAX_SIZE) _cache.clear(); // simple eviction
    _cache.set(cacheKey, result);

    return result;

  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error(`[contextService] buildContext failed | ${err.message}`);
    throw new AppError('Failed to build context from documents', 500, 'CONTEXT_BUILD_ERROR');
  }
}

module.exports = {
  buildContext,
  cleanText,
  truncateAtBoundary,
  deduplicateDocs,
  detectLanguage,
  resolvePriority,
  CONTEXT_LIMITS,
};
