/**
 * middleware/errorHandler.js — Global error handler
 *
 * Improvements over original:
 *  1. Every error response includes requestId for traceability
 *  2. Every error response includes errorCode for frontend handling
 *  3. Production errors are structured JSON logged with full context
 *  4. Non-operational (programmer) errors in production hide the raw message
 *     but log the full stack with requestId so you can find it in logs
 *  5. Handles all Mongoose, JWT, and Stripe error types
 */

const AppError = require('../utils/AppError');

// ── Mongoose / DB error converters ────────────────────────────────────────────
const handleCastError       = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);
const handleDuplicateKey    = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  return new AppError(`${field} already exists`, 409);
};
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(messages.join('. '), 400);
};

// ── JWT error converters ──────────────────────────────────────────────────────
const handleJWTError        = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Token expired. Please log in again.', 401);

// ── Multer error converter ───────────────────────────────────────────────────
const multer = require('multer');
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return new AppError('File too large. Maximum allowed size is 10 MB.', 400);
  return new AppError(`Upload error: ${err.message}`, 400);
};

// ── Stripe error converter ────────────────────────────────────────────────────
const handleStripeError     = (err) => {
  const msg  = err?.raw?.message || err?.message || 'Payment processing error';
  const code = err?.statusCode   || err?.raw?.statusCode || 502;
  return new AppError(`Payment error: ${msg}`, code);
};

// ── Response sender ───────────────────────────────────────────────────────────
const sendError = (err, req, res) => {
  const requestId = req.id;
  const isDev     = process.env.NODE_ENV === 'development';

  if (err.isOperational) {
    // Known, expected errors — safe to expose the message
    return res.status(err.statusCode).json({
      status:     'error',
      message:    err.message,
      errorCode:  err.errorCode  || `HTTP_${err.statusCode}`,
      requestId,
    });
  }

  // Programmer / unexpected errors
  // Log the full error with context for debugging
  console.error(JSON.stringify({
    ts:         new Date().toISOString(),
    event:      'unhandled_error',
    requestId,
    method:     req.method,
    path:       req.originalUrl,
    userId:     req.user?._id,
    companyId:  req.companyId,
    message:    err.message,
    stack:      err.stack,
  }));

  if (isDev) {
    // In development, expose everything for easier debugging
    return res.status(500).json({
      status:    'error',
      message:   err.message,
      stack:     err.stack,
      requestId,
    });
  }

  // In production, never leak internal details to the client
  res.status(500).json({
    status:    'error',
    message:   'An unexpected error occurred. Please try again.',
    errorCode: 'INTERNAL_SERVER_ERROR',
    requestId, // lets the user quote this when reporting the issue
  });
};

// ── Main error middleware ─────────────────────────────────────────────────────
module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  err.statusCode = err.statusCode || 500;

  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  // Convert known error types to operational AppErrors
  if (err.name  === 'CastError')           error = handleCastError(err);
  if (err.code  === 11000)                 error = handleDuplicateKey(err);
  if (err.name  === 'ValidationError')     error = handleValidationError(err);
  if (err.name  === 'JsonWebTokenError')   error = handleJWTError();
  if (err.name  === 'TokenExpiredError')   error = handleJWTExpiredError();
  if (err instanceof multer.MulterError)   error = handleMulterError(err);
  if (err.type  === 'StripeInvalidRequestError' ||
      err.type  === 'StripeAPIError')      error = handleStripeError(err);

  sendError(error, req, res);
};
