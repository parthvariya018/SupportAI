// server/utils/AppError.js

class AppError extends Error {
  /**
   * @param {string} message    - Human-readable description
   * @param {number} statusCode - HTTP status code
   * @param {string} code       - Machine-readable code (e.g. 'INVALID_MODEL')
   * @param {*}      upstream   - Raw external API error body, never discarded
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', upstream = null) {
    super(message);
    this.name       = 'AppError';
    this.statusCode = statusCode;
    this.code       = code;
    this.upstream   = upstream;   // preserves raw Google / OpenAI / Claude error body
    this.isOperational = true;    // distinguishes expected errors from programmer bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
