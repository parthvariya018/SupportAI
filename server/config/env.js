/**
 * config/env.js — Startup environment validation
 *
 * Validates all required environment variables before the server starts.
 * Crashes immediately with a clear message rather than failing mysteriously
 * at the first request that needs the missing variable.
 *
 * Add new required vars to REQUIRED_VARS.
 * Add new optional vars with defaults to OPTIONAL_VARS.
 */

const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLIENT_URL',   // required — no wildcard CORS fallback in any environment
];

// Optional vars — warn if missing but don't crash
// Email vars are recommended: without them password reset emails are not sent
// (the reset URL falls back to console.log in development only).
const RECOMMENDED_VARS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
];

// Stripe Price IDs — validated separately so each missing ID is named clearly
const STRIPE_PRICE_VARS = [
  'STRIPE_STARTER_MONTHLY',
  'STRIPE_STARTER_YEARLY',
  'STRIPE_PRO_MONTHLY',
  'STRIPE_PRO_YEARLY',
  'STRIPE_ENTERPRISE_MONTHLY',
  'STRIPE_ENTERPRISE_YEARLY',
  'STRIPE_CREDITS_SMALL',
  'STRIPE_CREDITS_MEDIUM',
  'STRIPE_CREDITS_LARGE',
];

// A valid Stripe Price ID starts with "price_" and is at least 20 chars
const isValidPriceId = (v) => v && v.startsWith('price_') && v.length >= 20;

function validateEnv() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error('\n❌  FATAL: Missing required environment variables:\n');
    missing.forEach((v) => console.error(`   • ${v}`));
    console.error('\nCopy server/.env.example to server/.env and fill in the values.\n');
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED_VARS.filter((v) => !process.env[v]);
  if (missingRecommended.length > 0) {
    console.warn('\n⚠️   WARNING: Missing recommended environment variables:');
    missingRecommended.forEach((v) => console.warn(`   • ${v} — some features will be disabled`));
    console.warn('');
  }

  // Validate Stripe Price IDs only when Stripe is configured
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_your')) {
    const invalidPriceIds = STRIPE_PRICE_VARS.filter((v) => !isValidPriceId(process.env[v]));
    if (invalidPriceIds.length > 0) {
      console.warn('\n⚠️   WARNING: Missing or invalid Stripe Price IDs (billing will fail for these):');
      invalidPriceIds.forEach((v) => console.warn(`   • ${v}`));
      console.warn('   Set these in server/.env from your Stripe Dashboard → Products.\n');
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️   WARNING: JWT_SECRET is too short. Use at least 32 random characters in production.');
  }
}

module.exports = { validateEnv };
