/**
 * middleware/requestId.js
 *
 * Stamps every incoming request with a unique ID so that every log line,
 * error, and response for a single request can be correlated across services.
 *
 * The ID is:
 *   - Added to req.id
 *   - Echoed back in the X-Request-ID response header
 *   - Read from the incoming X-Request-ID header when present
 *     (allows upstream proxies / load balancers to set it)
 */

const { v4: uuidv4 } = require('uuid');

const requestId = (req, res, next) => {
  // Honour upstream request ID (e.g. from Nginx, AWS ALB, or a client retry)
  req.id = req.headers['x-request-id'] || uuidv4();

  // Echo it back so clients / proxies can correlate responses
  res.setHeader('X-Request-ID', req.id);

  next();
};

module.exports = requestId;
