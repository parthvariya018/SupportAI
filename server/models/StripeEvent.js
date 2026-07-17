const mongoose = require('mongoose');

/**
 * StripeEvent — idempotency store for Stripe webhook events.
 *
 * Every incoming webhook event ID is written here with status 'processing'
 * before any DB side-effects run. If a duplicate event arrives while the
 * first is still in-flight, the unique index on `eventId` causes the insert
 * to throw E11000, which the webhook handler catches and silently ignores.
 *
 * Once processing completes the document is updated to status 'processed'.
 * If processing throws, the document is updated to status 'failed' so it
 * can be inspected and replayed manually if needed.
 *
 * TTL index: documents are automatically deleted after 30 days — Stripe's
 * own retry window is 3 days, so 30 days gives ample replay headroom while
 * keeping the collection from growing unbounded.
 */
const stripeEventSchema = new mongoose.Schema({
  eventId:   { type: String, required: true, unique: true, index: true },
  type:      { type: String, required: true },
  status:    { type: String, enum: ['processing', 'processed', 'failed'], default: 'processing' },
  error:     { type: String },
  createdAt: { type: Date,   default: Date.now, expires: 60 * 60 * 24 * 30 }, // 30-day TTL
});

module.exports = mongoose.model('StripeEvent', stripeEventSchema);
