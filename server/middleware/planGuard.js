const AppError = require('../utils/AppError');
const Company  = require('../models/Company');
const { getModel, getDefaultModel } = require('../config/modelRegistry');

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = {
  free: {
    name:               'Free',
    price:              { monthly: 0,   yearly: 0 },
    limits: {
      messagesPerMonth: 200,
      tokensPerMonth:   50_000,
      aiCredits:        50,          // included AI credits per month
      agents:           1,
      documents:        3,
      apiCallsPerDay:   50,
    },
    features: ['widget', 'basic_chat', 'leads'],
    creditRefillMonthly: 50,
  },

  starter: {
    name:  'Starter',
    price: { monthly: 19, yearly: 190 },
    limits: {
      messagesPerMonth: 2_000,
      tokensPerMonth:   500_000,
      aiCredits:        500,
      agents:           3,
      documents:        20,
      apiCallsPerDay:   500,
    },
    features: ['widget', 'tickets', 'kb', 'team', 'analytics'],
    creditRefillMonthly: 500,
  },

  pro: {
    name:  'Pro',
    price: { monthly: 49, yearly: 490 },
    limits: {
      messagesPerMonth: 10_000,
      tokensPerMonth:   2_000_000,
      aiCredits:        2_000,
      agents:           10,
      documents:        100,
      apiCallsPerDay:   5_000,
    },
    features: ['widget', 'tickets', 'kb', 'team', 'analytics', 'api', 'priority_support'],
    creditRefillMonthly: 2_000,
  },

  enterprise: {
    name:  'Enterprise',
    price: { monthly: 199, yearly: 1_990 },
    limits: {
      messagesPerMonth: Infinity,
      tokensPerMonth:   Infinity,
      aiCredits:        Infinity,
      agents:           Infinity,
      documents:        Infinity,
      apiCallsPerDay:   Infinity,
    },
    features: ['everything', 'sla', 'custom_ai', 'dedicated_support', 'white_label'],
    creditRefillMonthly: Infinity,
  },
};

// ── Cost calculation ─────────────────────────────────────────────────────────
// Pricing is sourced from the model registry so it stays in one place.
// Falls back to the default model's pricing when modelId is unknown.
const calcCostUsd = (inputTokens, outputTokens, modelId) => {
  const model = (modelId && getModel(modelId)) || getDefaultModel('free');
  const inputRate  = model.inputCostPerMillionTokens  ?? 0;
  const outputRate = model.outputCostPerMillionTokens ?? 0;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
};
// Single source of truth for every limit — reference this everywhere,
// never hardcode a number in a controller or route.
const PLAN_LIMITS = {
  free:       { messages: 200,    credits: 50,    agents: 1,        documents: 3   },
  starter:    { messages: 2_000,  credits: 500,   agents: 3,        documents: 20  },
  pro:        { messages: 10_000, credits: 2_000, agents: 10,       documents: 100 },
  enterprise: { messages: Infinity, credits: Infinity, agents: Infinity, documents: Infinity },
};

const getLimits = (plan) => PLANS[plan]?.limits || PLANS.free.limits;

// Convenience: get the simple 4-key limit object by plan name.
// Usage: const { messages, credits, agents, documents } = getPlanLimits(company.plan);
const getPlanLimits = (plan) => PLAN_LIMITS[plan] || PLAN_LIMITS.free;

// ── Standardised plan-limit response ────────────────────────────────────────
// All limit rejections return the same shape so the frontend can handle
// them with a single interceptor: { success, code, message }
const limitReached = (res, message) =>
  res.status(403).json({ success: false, code: 'PLAN_LIMIT_REACHED', message });

// ── Check message quota ───────────────────────────────────────────────────────
const checkMessageQuota = async (req, res, next) => {
  const company = req.company;
  if (!company) return next();

  await company.resetUsageIfNeeded();

  const { messages } = getPlanLimits(company.plan);
  if (messages !== Infinity && company.usage.messagesThisMonth >= messages)
    return limitReached(res, `You've reached your monthly message limit of ${messages.toLocaleString()}. Upgrade your plan to continue.`);

  next();
};

// ── Check AI credit balance ───────────────────────────────────────────────────
const checkCreditBalance = (req, res, next) => {
  const company = req.company;
  if (!company) return next();

  const { credits } = getPlanLimits(company.plan);
  if (credits === Infinity) return next();

  if (company.credits.balance <= 0)
    return limitReached(res, 'AI credits exhausted. Purchase more credits or upgrade your plan.');

  next();
};

// ── Check token quota ─────────────────────────────────────────────────────────
const checkTokenQuota = async (req, res, next) => {
  const company = req.company;
  if (!company) return next();

  const limits = getLimits(company.plan);
  if (limits.tokensPerMonth === Infinity) return next();

  if (company.usage.tokensThisMonth >= limits.tokensPerMonth)
    return limitReached(res, `Monthly token limit of ${(limits.tokensPerMonth / 1000).toLocaleString()}K reached. Upgrade your plan to continue.`);

  next();
};

// ── Check API call quota ──────────────────────────────────────────────────────
const checkApiQuota = async (req, res, next) => {
  const company = req.company;
  if (!company) return next();

  const limits = getLimits(company.plan);
  if (limits.apiCallsPerDay === Infinity) return next();

  const now      = new Date();
  const resetDay = new Date(company.usage.apiCallsResetAt);
  if (now.toDateString() !== resetDay.toDateString()) {
    await Company.findByIdAndUpdate(company._id, {
      'usage.apiCallsToday':   0,
      'usage.apiCallsResetAt': now,
    });
    company.usage.apiCallsToday = 0;
  }

  if (company.usage.apiCallsToday >= limits.apiCallsPerDay)
    return limitReached(res, `Daily API limit of ${limits.apiCallsPerDay.toLocaleString()} calls reached. Upgrade your plan to continue.`);

  next();
};

// ── Plan hierarchy ───────────────────────────────────────────────────────────
// Order matters: index = rank. A higher index = a higher plan.
const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

// ── requirePlan(minPlan) middleware ───────────────────────────────────────────
// Rejects if the company's current plan ranks below minPlan.
// Usage: router.use(requirePlan('starter'))
//        router.use(requirePlan('pro'))
//        router.use(requirePlan('enterprise'))
const requirePlan = (minPlan) => (req, res, next) => {
  const companyPlan = req.user?.companyId?.plan ?? 'free';
  if (PLAN_ORDER.indexOf(companyPlan) < PLAN_ORDER.indexOf(minPlan)) {
    return res.status(403).json({
      success: false,
      code:    'PLAN_UPGRADE_REQUIRED',
      message: 'Upgrade your plan to access this feature.',
    });
  }
  next();
};

// ── Increment usage after successful AI response ──────────────────────────────
// FIX: Single atomic $inc — no separate read step, no race condition.
// credits.balance is decremented atomically so it cannot go below 0 via
// concurrent requests reading the same value before either writes.
const incrementUsage = async (companyId, { tokens = 0, inputTokens = 0, outputTokens = 0, credits = 1 } = {}) => {
  await Company.findByIdAndUpdate(companyId, {
    $inc: {
      'usage.messagesThisMonth': 1,
      'usage.tokensThisMonth':   tokens,
      'usage.inputTokensTotal':  inputTokens,
      'usage.outputTokensTotal': outputTokens,
      'credits.totalConsumed':   credits,
      'credits.balance':         -credits,
    },
  });
  // Floor credits.balance at 0 — a second atomic update is cheaper than a
  // findOne + save and still avoids negative balances in the steady state.
  await Company.updateOne(
    { _id: companyId, 'credits.balance': { $lt: 0 } },
    { $set: { 'credits.balance': 0 } }
  );
};

// ── Refill monthly credits (called by billing webhook / cron) ─────────────────
// FIX: Use $max to set balance so a double-fire of the webhook never
// downgrades a balance that was already higher (e.g. user topped up).
const refillCredits = async (companyId, plan) => {
  const refill = PLANS[plan]?.creditRefillMonthly ?? PLANS.free.creditRefillMonthly;
  if (refill === Infinity) return;

  await Company.findByIdAndUpdate(companyId, {
    // $max: only raise the balance, never lower it
    $max: { 'credits.balance': refill },
    $set: { 'credits.lastTopUpAt': new Date() },
    $inc: { 'credits.totalPurchased': refill },
  });
};

module.exports = {
  PLAN_LIMITS,
  PLAN_ORDER,
  PLANS,
  getLimits,
  getPlanLimits,
  checkMessageQuota,
  checkCreditBalance,
  checkTokenQuota,
  checkApiQuota,
  requirePlan,
  incrementUsage,
  calcCostUsd,
  refillCredits,
};
