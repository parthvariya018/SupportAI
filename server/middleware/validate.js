const AppError = require('../utils/AppError');

/**
 * sanitizeBody — blocks NoSQL operator injection via req.body.
 *
 * MongoDB operators ($gt, $regex, $ne, …) arrive as JS objects when sent as:
 *   { "email": { "$gt": "" } }
 * Casting them with String() turns { "$gt": "" } → "[object Object]"
 * which will never match a real DB value.
 *
 * Apply as the FIRST middleware on every route that reads req.body fields
 * that go directly into MongoDB queries (auth, leads, settings, etc.).
 *
 * OWASP: A03:2021 – Injection
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      const val = req.body[key];
      // Coerce unexpected objects to strings — real payloads are primitives
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        req.body[key] = String(val); // {$ne:''} → '[object Object]'
      }
    }
  }
  next();
};

/**
 * validate(fields) — checks all required fields exist and are non-empty.
 * Usage: validate(['email', 'password'])
 */
const validate = (fields) => (req, res, next) => {
  const missing = fields.filter(
    (f) => req.body[f] === undefined || req.body[f] === null || String(req.body[f]).trim() === ''
  );
  if (missing.length > 0)
    return next(new AppError(`Missing required fields: ${missing.join(', ')}`, 400));
  next();
};

/**
 * validateEmail — checks email format with a strict regex.
 */
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)))
    return next(new AppError('Invalid email format', 400));
  next();
};

/**
 * validatePassword — enforces minimum length.
 */
const validatePassword = (field = 'password') => (req, res, next) => {
  const val = req.body[field];
  if (val && String(val).length < 6)
    return next(new AppError(`${field} must be at least 6 characters`, 400));
  next();
};

module.exports = { sanitizeBody, validate, validateEmail, validatePassword };
