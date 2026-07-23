# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first so this layer is cached unless deps change
COPY package.json package-lock.json ./

# ci install: exact versions, no devDeps
# pdf-parse needs its postinstall script to copy test files
RUN npm ci --omit=dev

# ── Stage 2: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source (everything not in .dockerignore)
COPY . .

# uploads/ and logs/ must exist and be writable
RUN mkdir -p uploads logs && chown -R appuser:appgroup /app

USER appuser

# Document the port — actual binding is via PORT env var
EXPOSE 5000

# SIGTERM → graceful shutdown (already handled in server.js)
STOPSIGNAL SIGTERM

# Healthcheck: poll /health every 30 s, allow 10 s to respond
# Fail after 3 consecutive failures (90 s total before Docker marks unhealthy)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
