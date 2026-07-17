/**
 * config/db.js — MongoDB connection with production-grade settings
 *
 * Key improvements over the original:
 *  • maxPoolSize: 10     — allow up to 10 concurrent DB connections per process
 *  • serverSelectionTimeoutMS — fail fast on unreachable cluster instead of hanging
 *  • socketTimeoutMS          — prevent sockets from hanging indefinitely
 *  • heartbeatFrequencyMS     — detect dead primary faster
 *  • Event listeners for disconnect/reconnect to keep logs observable
 */

const mongoose = require('mongoose');

const MONGO_OPTIONS = {
  maxPoolSize:               10,     // max concurrent connections
  minPoolSize:               2,      // keep at least 2 warm
  serverSelectionTimeoutMS:  5_000,  // fail fast if cluster is unreachable
  socketTimeoutMS:           45_000, // close sockets idle for 45 s
  heartbeatFrequencyMS:      10_000, // check primary every 10 s
  retryWrites:               true,
  retryReads:                true,
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB initial connection error:', err.message);
    process.exit(1);
  }

  // ── Connection lifecycle events ──────────────────────────────────────────
  mongoose.connection.on('disconnected', () =>
    console.warn('[MongoDB] Disconnected — Mongoose will auto-reconnect')
  );
  mongoose.connection.on('reconnected', () =>
    console.log('[MongoDB] Reconnected')
  );
  mongoose.connection.on('error', (err) =>
    console.error('[MongoDB] Connection error:', err.message)
  );
};

module.exports = connectDB;
