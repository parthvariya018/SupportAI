/**
 * middleware/requestLogger.js
 *
 * Structured request/response logger.
 *
 * Every log line includes:
 *   ts          — ISO timestamp
 *   requestId   — from req.id (set by requestId middleware)
 *   method      — HTTP method
 *   path        — URL path (no query string in the main field)
 *   statusCode  — response status
 *   latencyMs   — total request duration
 *   userId      — authenticated user ID (if available)
 *   companyId   — company ID (if available)
 *   ip          — client IP (respects X-Forwarded-For behind a proxy)
 *   userAgent   — client user-agent
 *
 * In development, logs a human-readable one-liner instead.
 */

const isDev = process.env.NODE_ENV !== 'production';

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Capture response finish to log after status code is known
  res.on('finish', () => {
    const latencyMs = Date.now() - start;
    const status    = res.statusCode;

    if (isDev) {
      // Coloured one-liner in dev
      const colour =
        status >= 500 ? '\x1b[31m' :  // red
        status >= 400 ? '\x1b[33m' :  // yellow
        status >= 200 ? '\x1b[32m' :  // green
        '\x1b[0m';
      console.log(
        `${colour}${req.method} ${req.originalUrl} ${status} ${latencyMs}ms\x1b[0m` +
        (req.id ? ` [${req.id.slice(0, 8)}]` : '')
      );
      return;
    }

    // Structured JSON in production
    const entry = {
      ts:        new Date().toISOString(),
      requestId: req.id,
      method:    req.method,
      path:      req.path,
      query:     Object.keys(req.query).length ? req.query : undefined,
      status,
      latencyMs,
      userId:    req.user?._id,
      companyId: req.companyId,
      ip:        req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    // Remove undefined fields to keep logs clean
    Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);

    if (status >= 500) console.error(JSON.stringify(entry));
    else if (status >= 400) console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  });

  next();
};

module.exports = requestLogger;
