// ── Bootstrap: validate env BEFORE anything else ─────────────────────────────
require('dotenv').config();
const { validateEnv } = require('./config/env');
validateEnv();

const http           = require('http');
const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const compression    = require('compression');
const rateLimit      = require('express-rate-limit');
const mongoSanitize  = require('express-mongo-sanitize');
const mongoose       = require('mongoose');

const connectDB      = require('./config/db');
const { initSocket } = require('./config/socket');
const errorHandler   = require('./middleware/errorHandler');
const requestId      = require('./middleware/requestId');
const requestLogger  = require('./middleware/requestLogger');
const AppError       = require('./utils/AppError');
const { protect }    = require('./middleware/auth');

const app    = express();
const server = http.createServer(app);

connectDB();
initSocket(server);

// Verify SMTP transport after DB connects (non-blocking)
const { verifyTransport } = require('./services/emailService');
verifyTransport();

// ── CORS policies ─────────────────────────────────────────────────────────────
//
// Two separate policies are used:
//
//  dashboardCors — strict, credentials-enabled, CLIENT_URL only.
//                  Applied to every route except the two public widget endpoints.
//
//  widgetCors    — open origin (*), no credentials.
//                  Applied only to POST /api/chat/message and POST /api/leads
//                  so the embeddable widget can be loaded from any customer site.

const dashboardCors = cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    // and requests from exactly CLIENT_URL.
    // For all other origins, pass false — cors will omit the ACAO header
    // and the browser will block the request.
    if (!origin || origin === process.env.CLIENT_URL) return cb(null, true);
    cb(null, false);
  },
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
  exposedHeaders: ['X-Request-ID'],
  credentials:    true,
});

// Widget endpoints are public — any origin, no cookies/credentials.
// 'x-api-key' is the only custom header the widget sends.
const widgetCors = cors({
  origin:         '*',
  methods:        ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-request-id'],
  exposedHeaders: ['X-Request-ID'],
  credentials:    false,
});

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Preflight for widget endpoints — must be registered before the global dashboard policy
app.options('/api/chat/message', widgetCors);
app.options('/api/leads',        widgetCors);

// All other preflight requests go through the strict dashboard policy
app.options('*', dashboardCors);

// Apply dashboard CORS globally — widget routes will override below
app.use(dashboardCors);

// ── Request ID + structured logging ──────────────────────────────────────────
// Must come before any route so req.id is available everywhere
app.use(requestId);
app.use(requestLogger);

// ── Compression ───────────────────────────────────────────────────────────────
// Gzip all responses > 1KB — reduces payload by ~70% for JSON APIs
app.use(compression());

// ── Stripe webhook needs raw body — mount BEFORE express.json() ───────────────
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());   // strip $ and . from req.body/params/query — prevents NoSQL injection
app.use(express.static('public'));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            300,
  standardHeaders: true,
  legacyHeaders:  false,
  // Include requestId in rate limit errors so they're traceable
  handler: (req, res) => res.status(429).json({
    status:    'error',
    message:   'Too many requests. Please slow down.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    requestId: req.id,
  }),
});

const chatLimiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  handler: (req, res) => res.status(429).json({
    status:    'error',
    message:   'Chat rate limit exceeded. Please wait a moment.',
    errorCode: 'CHAT_RATE_LIMIT',
    requestId: req.id,
  }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  handler: (req, res) => res.status(429).json({
    status:    'error',
    message:   'Too many auth attempts. Please try again later.',
    errorCode: 'AUTH_RATE_LIMIT',
    requestId: req.id,
  }),
});

app.use('/api', globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
// Widget endpoints are mounted first with widgetCors injected inline so the
// open CORS headers are written before any route handler runs.
// The same router is also mounted at /api/chat for dashboard history routes —
// those requests come from CLIENT_URL and get dashboardCors from the global use().
app.use('/api/chat/message', widgetCors, chatLimiter, require('./routes/chat'));
app.use('/api/leads',        widgetCors,              require('./routes/leads'));

app.use('/api/auth',      authLimiter,  require('./routes/auth'));
app.use('/api/documents',              require('./routes/documents'));
app.use('/api/chat',      chatLimiter,  require('./routes/chat'));
app.use('/api/dashboard',              require('./routes/dashboard'));
app.use('/api/settings',               require('./routes/settings'));
app.use('/api/tickets',                require('./routes/tickets'));
app.use('/api/knowledge',              require('./routes/knowledge'));
app.use('/api/team',                   require('./routes/team'));
app.use('/api/analytics',              require('./routes/analytics'));
app.use('/api/billing',                require('./routes/billing'));
app.use('/api/models',                 require('./routes/models'));

// ── Health / Readiness / Metrics endpoints ───────────────────────────────────

/**
 * GET /health — liveness probe
 * Returns 200 as long as the process is running.
 * Used by Docker HEALTHCHECK, Kubernetes liveness probe, uptime monitors.
 */
app.get('/health', (_, res) => res.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
  uptime:    Math.round(process.uptime()),
  version:   process.env.npm_package_version || '2.0.0',
}));

/**
 * GET /ready — readiness probe
 * Returns 200 only when the DB connection is ready to serve traffic.
 * Used by Kubernetes readiness probe / load balancers to know when to
 * route traffic here. Returns 503 during startup or DB reconnection.
 */
app.get('/ready', (_, res) => {
  const dbState = mongoose.connection.readyState;
  // 1 = connected
  if (dbState === 1) {
    return res.json({ status: 'ready', db: 'connected' });
  }
  return res.status(503).json({
    status: 'not_ready',
    db:     ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
  });
});

/**
 * GET /metrics — basic process metrics
 * Returns Node.js process metrics for monitoring dashboards.
 * Protected by JWT — only authenticated dashboard users can access.
 * In production, replace with a Prometheus /metrics endpoint
 * using the `prom-client` library for richer observability.
 */
app.get('/metrics', protect, (_, res) => {
  const mem = process.memoryUsage();
  res.json({
    timestamp:      new Date().toISOString(),
    uptime:         process.uptime(),
    memoryMB: {
      rss:          +(mem.rss          / 1024 / 1024).toFixed(2),
      heapUsed:     +(mem.heapUsed     / 1024 / 1024).toFixed(2),
      heapTotal:    +(mem.heapTotal    / 1024 / 1024).toFixed(2),
      external:     +(mem.external     / 1024 / 1024).toFixed(2),
    },
    node:     process.version,
    platform: process.platform,
    env:      process.env.NODE_ENV || 'development',
    db: {
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
      pool:  mongoose.connection.pool?.totalConnectionCount ?? null,
    },
  });
});

// ── 404 + global error handler ────────────────────────────────────────────────
app.all('*', (req, _, next) => next(new AppError(`Route ${req.originalUrl} not found`, 404)));
app.use(errorHandler);

// ── Server start ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`SupportAI server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Close the HTTP server before exiting so in-flight requests can finish.
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed. Exiting.');
      process.exit(0);
    });
  });
  // Force exit after 10 s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err?.message || err);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err?.message || err);
  process.exit(1);
});
