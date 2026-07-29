// server/utils/retry.js

const AppError = require('./AppError');

// HTTP status codes that are safe to retry
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// Default retry configuration — all values come from this object, never hardcoded below
const DEFAULT_OPTIONS = {
  maxRetries:     3,
  baseDelayMs:    500,   // first retry waits ~500 ms
  maxDelayMs:     8000,  // cap so backoff never exceeds 8 s
  timeoutMs:      30000, // AbortController timeout per attempt
  jitter:         true,  // adds randomness to avoid thundering herd
};

/**
 * Calculates delay for attempt N using exponential backoff + optional jitter.
 * @param {number}  attempt  - 0-based attempt index
 * @param {object}  options
 * @returns {number} delay in milliseconds
 */
function calcDelay(attempt, options) {
  const exp = options.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exp, options.maxDelayMs);
  return options.jitter
    ? Math.floor(capped * (0.5 + Math.random() * 0.5)) // jitter: 50–100% of capped
    : capped;
}

/**
 * Returns true if the error is worth retrying.
 * Handles both HTTP status errors and network-level errors.
 * @param {Error} err
 * @returns {boolean}
 */
function isRetryable(err) {
  if (err instanceof AppError) {
    return RETRYABLE_STATUS_CODES.has(err.statusCode);
  }
  // Network errors (ECONNRESET, ETIMEDOUT, fetch AbortError) are retryable
  const retryableCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ABORT_ERR']);
  return retryableCodes.has(err.code) || err.name === 'AbortError';
}

/**
 * Wraps an async function with retry logic, exponential backoff, and per-attempt timeout.
 *
 * @param {Function} fn       - Async function to execute. Receives an AbortSignal as its argument.
 * @param {object}   opts     - Override any DEFAULT_OPTIONS key
 * @returns {Promise<*>}      - Resolves with fn's return value or throws AppError after all retries
 *
 * @example
 *   const result = await withRetry((signal) => callGemini(payload, signal), { maxRetries: 3 });
 */
async function withRetry(fn, opts = {}) {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  let lastError;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;

    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      const isLastAttempt = attempt === options.maxRetries;

      if (isLastAttempt || !isRetryable(err)) {
        // Preserve AppError as-is; wrap everything else
        if (err instanceof AppError) throw err;

        throw new AppError(
          err.message || 'External API call failed',
          err.statusCode || 500,
          'EXTERNAL_API_ERROR',
          err.upstream ?? null   // carry upstream body if already attached
        );
      }

      const delay = calcDelay(attempt, options);
      console.error(
        `[retry] attempt ${attempt + 1}/${options.maxRetries} failed — ` +
        `retrying in ${delay}ms | reason: ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but safety net
  throw lastError;
}

module.exports = { withRetry, isRetryable, calcDelay, RETRYABLE_STATUS_CODES };
