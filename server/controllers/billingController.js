const Company     = require('../models/Company');
const Document    = require('../models/Document');
const User        = require('../models/User');
const UsageEvent  = require('../models/UsageEvent');
const StripeEvent = require('../models/StripeEvent');
const AppError    = require('../utils/AppError');
const catchAsync  = require('../utils/catchAsync');
const { PLANS, PLAN_LIMITS, getPlanLimits, refillCredits } = require('../middleware/planGuard');
const { sendPaymentFailed, sendSubscriptionCancelled, sendTrialEnding } = require('../services/emailService');

// ── Bug 1 fix: lazy Stripe init — never crash on missing/placeholder key ──────
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_your')) {
    throw new AppError(
      'Stripe is not configured. Set STRIPE_SECRET_KEY in your .env file.',
      503
    );
  }
  _stripe = require('stripe')(key);
  return _stripe;
}

// ── Price ID map ──────────────────────────────────────────────────────────────
const PRICE_IDS = {
  starter:    { monthly: process.env.STRIPE_STARTER_MONTHLY,    yearly: process.env.STRIPE_STARTER_YEARLY },
  pro:        { monthly: process.env.STRIPE_PRO_MONTHLY,        yearly: process.env.STRIPE_PRO_YEARLY },
  enterprise: { monthly: process.env.STRIPE_ENTERPRISE_MONTHLY, yearly: process.env.STRIPE_ENTERPRISE_YEARLY },
};

// ── Bug 3 fix: wrap any Stripe SDK error as an operational AppError ────────────
function wrapStripeError(err) {
  if (err instanceof AppError) return err;
  // Stripe errors carry a 'type' property
  const msg = err?.raw?.message || err?.message || 'Stripe request failed';
  const code = err?.statusCode || err?.raw?.statusCode || 502;
  return new AppError(`Payment error: ${msg}`, code);
}

// ── GET /api/billing/plans ────────────────────────────────────────────────────
exports.getPlans = (req, res) => {
  const plans = Object.entries(PLANS).map(([id, p]) => {
    const lim = PLAN_LIMITS[id];
    return {
      id,
      name:          p.name,
      price:         p.price,
      features:      p.features,
      stripePriceId: PRICE_IDS[id] || null,
      limits: {
        messages:  lim.messages  === Infinity ? null : lim.messages,
        credits:   lim.credits   === Infinity ? null : lim.credits,
        agents:    lim.agents    === Infinity ? null : lim.agents,
        documents: lim.documents === Infinity ? null : lim.documents,
      },
    };
  });
  res.json({ status: 'success', plans });
};

// ── GET /api/billing/subscription ────────────────────────────────────────────
exports.getSubscription = catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId);
  if (!company) throw new AppError('Company not found', 404);

  const planLimits = getPlanLimits(company.plan);

  // Fetch live counts in parallel — never trust cached counters alone
  const [realDocCount, realAgentCount] = await Promise.all([
    Document.countDocuments({ companyId: company._id }),
    User.countDocuments({ companyId: company._id }),
  ]);

  // Self-heal cached counter if it drifted
  if (company.usage.documentsCount !== realDocCount) {
    await Company.findByIdAndUpdate(company._id, { 'usage.documentsCount': realDocCount });
  }

  // Normalize Infinity → null so JSON serializes cleanly;
  // frontend treats null as "Unlimited"
  const serializeLimit = (v) => (v === Infinity ? null : v);

  const payload = {
    plan:               company.plan,
    subscriptionStatus: company.subscriptionStatus,
    cancelAtPeriodEnd:  company.cancelAtPeriodEnd,
    currentPeriodEnd:   company.currentPeriodEnd,
    trialEndsAt:        company.trialEndsAt,
    // Flat limits keyed by resource name — single source of truth from PLAN_LIMITS
    limits: {
      messages:  serializeLimit(planLimits.messages),
      credits:   serializeLimit(planLimits.credits),
      agents:    serializeLimit(planLimits.agents),
      documents: serializeLimit(planLimits.documents),
    },
    // Live usage — agents and documents come from real DB counts
    usage: {
      messages:  company.usage.messagesThisMonth,
      credits:   company.credits.totalConsumed,
      agents:    realAgentCount,
      documents: realDocCount,
    },
    credits: {
      balance:        company.credits.balance,
      totalConsumed:  company.credits.totalConsumed,
      totalPurchased: company.credits.totalPurchased,
      lastTopUpAt:    company.credits.lastTopUpAt,
    },
  };

  // Enrich from live Stripe data when available
  if (company.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      const sub    = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
      payload.subscriptionStatus = sub.status;
      payload.cancelAtPeriodEnd  = sub.cancel_at_period_end;
      payload.currentPeriodEnd   = new Date(sub.current_period_end * 1000);
    } catch { /* Stripe unconfigured in dev — use DB values */ }
  }

  res.json({ status: 'success', subscription: payload });
});

// ── GET /api/billing/usage ────────────────────────────────────────────────────
exports.getUsage = catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId);
  if (!company) throw new AppError('Company not found', 404);

  const planLimits = getPlanLimits(company.plan);
  const days = Math.min(90, parseInt(req.query.days) || 30);
  const from = new Date(Date.now() - days * 86_400_000);

  const [dailyUsage, totals, realDocCount, realAgentCount] = await Promise.all([
    UsageEvent.aggregate([
      { $match: { companyId: company._id, type: 'ai_response', createdAt: { $gte: from } } },
      { $group: {
        _id:          { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        messages:     { $sum: 1 },
        totalTokens:  { $sum: '$totalTokens' },
        credits:      { $sum: '$creditsUsed' },
        costUsd:      { $sum: '$costUsd' },
      }},
      { $sort: { _id: 1 } },
    ]),
    UsageEvent.aggregate([
      { $match: { companyId: company._id, type: 'ai_response', createdAt: { $gte: from } } },
      { $group: {
        _id:      null,
        messages: { $sum: 1 },
        credits:  { $sum: '$creditsUsed' },
        costUsd:  { $sum: '$costUsd' },
      }},
    ]),
    Document.countDocuments({ companyId: company._id }),
    User.countDocuments({ companyId: company._id }),
  ]);

  const period = totals[0] ?? { messages: 0, credits: 0, costUsd: 0 };
  const sl = (v) => (v === Infinity ? null : v);
  const pct = (used, limit) =>
    !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));

  res.json({
    status: 'success',
    period: { days, from },
    usage: {
      messages:  company.usage.messagesThisMonth,
      credits:   company.credits.totalConsumed,
      agents:    realAgentCount,
      documents: realDocCount,
    },
    limits: {
      messages:  sl(planLimits.messages),
      credits:   sl(planLimits.credits),
      agents:    sl(planLimits.agents),
      documents: sl(planLimits.documents),
    },
    percentages: {
      messages:  pct(company.usage.messagesThisMonth, planLimits.messages),
      credits:   pct(company.credits.totalConsumed,   planLimits.credits),
      agents:    pct(realAgentCount,                  planLimits.agents),
      documents: pct(realDocCount,                    planLimits.documents),
    },
    periodTotals: { ...period, costUsd: +period.costUsd.toFixed(6) },
    dailyUsage,
  });
});

// ── POST /api/billing/subscribe ───────────────────────────────────────────────
exports.createCheckoutSession = catchAsync(async (req, res, next) => {
  const stripe = getStripe();
  const { planId, interval = 'monthly' } = req.body;

  if (!PRICE_IDS[planId])
    return next(new AppError('Invalid plan. Choose: starter, pro, or enterprise.', 400));

  const priceId = PRICE_IDS[planId]?.[interval];

  // Bug 3 fix: detect placeholder price IDs explicitly
  if (!priceId || priceId.includes('_id') || priceId.startsWith('price_') && priceId.length < 20)
    return next(new AppError(
      `Stripe price ID for ${planId}/${interval} is not configured. ` +
      `Set STRIPE_${planId.toUpperCase()}_${interval.toUpperCase()} in .env`,
      503
    ));

  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  try {
    // Ensure Stripe customer exists.
    // Idempotency key: scoped to companyId so concurrent requests for the
    // same company never create two Stripe customer records.
    let customerId = company.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email:    company.email,
          name:     company.name,
          metadata: { companyId: String(company._id) },
        },
        { idempotencyKey: `customer-create-${company._id}` }
      );
      customerId = customer.id;
      await Company.findByIdAndUpdate(company._id, { stripeCustomerId: customerId });
    }

    const isFirstSubscription = !company.stripeSubscriptionId;

    // Idempotency key: scoped to company + plan + interval so a double-click
    // or network retry returns the same session rather than creating a second.
    const session = await stripe.checkout.sessions.create(
      {
        customer:    customerId,
        mode:        'subscription',
        line_items:  [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.CLIENT_URL}/app/billing?checkout=success&plan=${planId}`,
        cancel_url:  `${process.env.CLIENT_URL}/app/billing?checkout=canceled`,
        metadata:    { companyId: String(company._id), planId, interval },
        subscription_data: {
          metadata: { companyId: String(company._id), planId, interval },
          // 7-day trial only for first-time subscribers on free plan
          ...(isFirstSubscription && company.plan === 'free' ? { trial_period_days: 7 } : {}),
        },
        allow_promotion_codes: true,
      },
      { idempotencyKey: `checkout-subscribe-${company._id}-${planId}-${interval}` }
    );

    res.json({ status: 'success', url: session.url });
  } catch (err) {
    return next(wrapStripeError(err));
  }
});

// ── POST /api/billing/upgrade (immediate proration, no redirect) ──────────────
exports.upgradeSubscription = catchAsync(async (req, res, next) => {
  const stripe = getStripe();
  const { planId, interval = 'monthly' } = req.body;

  if (!PRICE_IDS[planId])
    return next(new AppError('Invalid plan', 400));

  const priceId = PRICE_IDS[planId]?.[interval];
  if (!priceId || priceId.includes('_id'))
    return next(new AppError(`Price ID for ${planId}/${interval} not configured`, 503));

  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  if (!company.stripeSubscriptionId)
    return next(new AppError('No active subscription. Please use the subscribe flow.', 400));

  try {
    const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
    // Idempotency key: scoped to subscription + target plan so retrying the
    // same upgrade request never applies the proration twice.
    await stripe.subscriptions.update(
      company.stripeSubscriptionId,
      {
        proration_behavior: 'create_prorations',
        items: [{ id: sub.items.data[0].id, price: priceId }],
        metadata: { companyId: String(company._id), planId, interval },
      },
      { idempotencyKey: `sub-upgrade-${company.stripeSubscriptionId}-${planId}-${interval}` }
    );

    await Company.findByIdAndUpdate(company._id, { plan: planId });
    await refillCredits(company._id, planId);

    res.json({ status: 'success', message: `Upgraded to ${PLANS[planId]?.name || planId} plan` });
  } catch (err) {
    return next(wrapStripeError(err));
  }
});

// ── POST /api/billing/cancel ──────────────────────────────────────────────────
exports.cancelSubscription = catchAsync(async (req, res, next) => {
  const stripe = getStripe();
  const { immediately = false } = req.body;
  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  if (!company.stripeSubscriptionId)
    return next(new AppError('No active subscription found', 400));

  try {
    if (immediately) {
      // Bug 10 fix: stripe.subscriptions.cancel() is the correct method (not .del)
      await stripe.subscriptions.cancel(company.stripeSubscriptionId);
      await Company.findByIdAndUpdate(company._id, {
        plan:                 'free',
        stripeSubscriptionId: null,
        subscriptionStatus:   'canceled',
        cancelAtPeriodEnd:    false,
      });
      await refillCredits(company._id, 'free');
    } else {
      // Idempotency key: safe to retry — setting cancel_at_period_end=true
      // on an already-canceling subscription is a no-op on Stripe's side.
      await stripe.subscriptions.update(
        company.stripeSubscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: `sub-cancel-${company.stripeSubscriptionId}` }
      );
      await Company.findByIdAndUpdate(company._id, { cancelAtPeriodEnd: true });
    }

    res.json({
      status:  'success',
      message: immediately
        ? 'Subscription canceled. You are now on the Free plan.'
        : 'Subscription will cancel at the end of the billing period.',
    });

    // Fire-and-forget cancellation confirmation email
    const owner = await User.findOne({ companyId: req.companyId, role: 'owner' }).select('email').lean();
    if (owner) {
      sendSubscriptionCancelled(
        owner.email,
        company.name,
        immediately ? null : company.currentPeriodEnd,
        `${process.env.CLIENT_URL}/app/billing`
      );
    }
  } catch (err) {
    return next(wrapStripeError(err));
  }
});

// ── POST /api/billing/reactivate ──────────────────────────────────────────────
exports.reactivateSubscription = catchAsync(async (req, res, next) => {
  const stripe  = getStripe();
  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  if (!company.stripeSubscriptionId)
    return next(new AppError('No subscription to reactivate', 400));

  try {
    // Idempotency key: safe to retry — reactivating an already-active
    // subscription is a no-op on Stripe's side.
    await stripe.subscriptions.update(
      company.stripeSubscriptionId,
      { cancel_at_period_end: false },
      { idempotencyKey: `sub-reactivate-${company.stripeSubscriptionId}` }
    );
    await Company.findByIdAndUpdate(company._id, { cancelAtPeriodEnd: false });
    res.json({ status: 'success', message: 'Subscription reactivated' });
  } catch (err) {
    return next(wrapStripeError(err));
  }
});

// ── POST /api/billing/portal ──────────────────────────────────────────────────
exports.createPortalSession = catchAsync(async (req, res, next) => {
  const stripe  = getStripe();
  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  if (!company.stripeCustomerId)
    return next(new AppError('No billing account found. Please subscribe to a plan first.', 400));

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   company.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/app/billing`,
    });
    res.json({ status: 'success', url: session.url });
  } catch (err) {
    return next(wrapStripeError(err));
  }
});

// ── POST /api/billing/credits/topup ──────────────────────────────────────────
exports.topUpCredits = catchAsync(async (req, res, next) => {
  const stripe = getStripe();
  const { pack = 'small' } = req.body;

  const CREDIT_PACKS = {
    small:  { credits: 500,   priceId: process.env.STRIPE_CREDITS_SMALL  },
    medium: { credits: 2000,  priceId: process.env.STRIPE_CREDITS_MEDIUM },
    large:  { credits: 10000, priceId: process.env.STRIPE_CREDITS_LARGE  },
  };

  const selected = CREDIT_PACKS[pack];
  if (!selected) return next(new AppError('Invalid credit pack. Choose: small, medium, large', 400));

  if (!selected.priceId)
    return next(new AppError(`Stripe price ID for credit pack "${pack}" is not configured. Set STRIPE_CREDITS_${pack.toUpperCase()} in .env`, 503));

  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  try {
    let customerId = company.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: company.email, name: company.name,
          metadata: { companyId: String(company._id) },
        },
        { idempotencyKey: `customer-create-${company._id}` }
      );
      customerId = customer.id;
      await Company.findByIdAndUpdate(company._id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create(
      {
        customer:    customerId,
        mode:        'payment',
        line_items:  [{ price: selected.priceId, quantity: 1 }],
        success_url: `${process.env.CLIENT_URL}/app/billing?checkout=credits&pack=${pack}`,
        cancel_url:  `${process.env.CLIENT_URL}/app/billing`,
        metadata:    { companyId: String(company._id), type: 'credit_topup', pack, credits: String(selected.credits) },
      },
      { idempotencyKey: `checkout-topup-${company._id}-${pack}` }
    );

    res.json({ status: 'success', url: session.url });
  } catch (err) {
    return next(wrapStripeError(err));
  }
});

// ── GET /api/billing/invoices ─────────────────────────────────────────────────
exports.getInvoices = catchAsync(async (req, res, next) => {
  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  if (!company.stripeCustomerId)
    return res.json({ status: 'success', invoices: [] });

  try {
    const stripe = getStripe();
    const { data: invoices } = await stripe.invoices.list({
      customer: company.stripeCustomerId,
      limit:    24,
      expand:   ['data.subscription'],
    });

    res.json({
      status: 'success',
      invoices: invoices.map((inv) => ({
        id:          inv.id,
        number:      inv.number,
        description: inv.lines?.data?.[0]?.description || inv.description || '',
        amount:      inv.amount_paid / 100,
        currency:    inv.currency.toUpperCase(),
        status:      inv.status,
        pdfUrl:      inv.invoice_pdf,
        hostedUrl:   inv.hosted_invoice_url,
        createdAt:   new Date(inv.created * 1000).toISOString(),
        periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        periodEnd:   inv.period_end   ? new Date(inv.period_end   * 1000).toISOString() : null,
      })),
    });
  } catch (err) {
    // Gracefully degrade — return empty list rather than 500
    console.error('[billing] invoices fetch error:', err.message);
    return res.json({ status: 'success', invoices: [] });
  }
});

// ── POST /api/billing/webhook ─────────────────────────────────────────────────
exports.handleWebhook = (req, res) => {
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    // Stripe not configured — acknowledge webhook to avoid Stripe retries
    return res.json({ received: true });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  // Signature verification is unchanged — raw body required (mounted in server.js)
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Respond immediately — process asynchronously
  res.json({ received: true });
  handleStripeEvent(event).catch((err) =>
    console.error('[webhook] Event handler error:', err.message)
  );
};

async function handleStripeEvent(event) {
  // ── Idempotency guard ───────────────────────────────────────────────────────
  // Attempt to insert the event ID with status 'processing'.
  // The unique index on eventId causes a duplicate-key error (E11000) if this
  // event was already received, which we catch and silently skip.
  // Using insertOne rather than findOneAndUpdate so the insert is atomic —
  // two concurrent retries of the same event cannot both pass this gate.
  try {
    await StripeEvent.create({ eventId: event.id, type: event.type });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate event — Stripe is retrying something we already processed
      console.log(`[webhook] Duplicate event ignored: ${event.id} (${event.type})`);
      return;
    }
    // Unexpected DB error — log and continue so we don't silently drop the event
    console.error('[webhook] Failed to record event ID:', err.message);
  }

  try {
    await processStripeEvent(event);
    // Mark as processed — failure to update is non-critical (event was handled)
    await StripeEvent.updateOne({ eventId: event.id }, { status: 'processed' });
  } catch (err) {
    await StripeEvent.updateOne({ eventId: event.id }, { status: 'failed', error: err.message });
    throw err; // re-throw so the outer .catch() logs it
  }
}

// ── Known valid plan IDs — used to validate webhook metadata ─────────────────
const VALID_PLAN_IDS = new Set(['starter', 'pro', 'enterprise']);

// ── Structured webhook skip logger ───────────────────────────────────────────
// Centralises all skip/warn output so every skipped event has the same shape:
// [webhook:skip] <eventType> <sessionId> reason=<reason> <extra k=v pairs>
function webhookSkip(eventType, objectId, reason, extra = {}) {
  const parts = Object.entries(extra).map(([k, v]) => `${k}=${v}`);
  console.warn(
    `[webhook:skip] ${eventType} ${objectId} reason=${reason}${
      parts.length ? ' ' + parts.join(' ') : ''
    }`
  );
}

// ── Structured webhook action logger ─────────────────────────────────────────
function webhookInfo(eventType, objectId, action, extra = {}) {
  const parts = Object.entries(extra).map(([k, v]) => `${k}=${v}`);
  console.log(
    `[webhook:ok] ${eventType} ${objectId} action=${action}${
      parts.length ? ' ' + parts.join(' ') : ''
    }`
  );
}

async function processStripeEvent(event) {
  const obj = event.data.object;

  switch (event.type) {

    // ── checkout.session.completed ──────────────────────────────────────────
    case 'checkout.session.completed': {
      const meta      = obj.metadata || {};
      const companyId = meta.companyId;
      const planId    = meta.planId;
      const type      = meta.type;

      // ── credit top-up path ────────────────────────────────────────────────
      if (type === 'credit_topup') {
        // Require payment_status === 'paid' — one-time payments have no
        // 'no_payment_required' state so anything other than 'paid' is invalid.
        if (obj.payment_status !== 'paid') {
          webhookSkip(event.type, obj.id, 'payment_not_paid',
            { payment_status: obj.payment_status, type: 'credit_topup' });
          break;
        }

        // Validate required metadata before touching the DB
        if (!companyId) {
          webhookSkip(event.type, obj.id, 'missing_metadata', { field: 'companyId', type: 'credit_topup' });
          break;
        }
        const credits = parseInt(meta.credits || '0', 10);
        if (!credits || credits <= 0) {
          webhookSkip(event.type, obj.id, 'invalid_credits', { credits: meta.credits, type: 'credit_topup' });
          break;
        }

        await Company.findByIdAndUpdate(companyId, {
          $inc: { 'credits.balance': credits, 'credits.totalPurchased': credits },
          $set: { 'credits.lastTopUpAt': new Date() },
        });
        webhookInfo(event.type, obj.id, 'credits_applied', { companyId, credits });
        break;
      }

      // ── subscription checkout path ────────────────────────────────────────

      // Guard 1: mode must be 'subscription'.
      // Any other mode (e.g. 'payment') reaching this branch is unexpected.
      if (obj.mode !== 'subscription') {
        webhookSkip(event.type, obj.id, 'wrong_mode', { mode: obj.mode });
        break;
      }

      // Guard 2: payment_status must be exactly 'paid'.
      // Explicitly rejected statuses and why:
      //   'unpaid'              — payment failed or was never attempted
      //   'no_payment_required' — free trial with no card; the subscription
      //                           activates via customer.subscription.updated
      //                           (status=trialing) — we must NOT upgrade the
      //                           plan here or the user gets paid features for free
      //   anything else         — unknown / future Stripe value, reject safely
      if (obj.payment_status !== 'paid') {
        webhookSkip(event.type, obj.id, 'payment_not_paid',
          { payment_status: obj.payment_status, mode: obj.mode });
        break;
      }

      // Guard 3: required metadata must be present and valid.
      if (!companyId) {
        webhookSkip(event.type, obj.id, 'missing_metadata', { field: 'companyId' });
        break;
      }
      if (!planId) {
        webhookSkip(event.type, obj.id, 'missing_metadata', { field: 'planId', companyId });
        break;
      }
      if (!VALID_PLAN_IDS.has(planId)) {
        webhookSkip(event.type, obj.id, 'unknown_plan', { planId, companyId });
        break;
      }

      // Guard 4: Stripe must have created a subscription object.
      // obj.subscription is null when the session is in certain incomplete states.
      if (!obj.subscription) {
        webhookSkip(event.type, obj.id, 'missing_subscription_id', { companyId, planId });
        break;
      }

      // All guards passed — safe to upgrade
      await Company.findByIdAndUpdate(companyId, {
        plan:                 planId,
        stripeSubscriptionId: obj.subscription,
        subscriptionStatus:   'active',
        cancelAtPeriodEnd:    false,
      });
      await refillCredits(companyId, planId);
      webhookInfo(event.type, obj.id, 'subscription_activated',
        { companyId, planId, subscription: obj.subscription });
      break;
    }

    // ── customer.subscription.updated ──────────────────────────────────────
    case 'customer.subscription.updated': {
      const { companyId, planId } = obj.metadata || {};

      if (!companyId) {
        webhookSkip(event.type, obj.id, 'missing_metadata', { field: 'companyId' });
        break;
      }

      const update = {
        stripeSubscriptionId: obj.id,
        subscriptionStatus:   obj.status,
        cancelAtPeriodEnd:    obj.cancel_at_period_end,
        currentPeriodEnd:     new Date(obj.current_period_end * 1000),
      };
      // Only write planId to DB if it is a known valid value
      if (planId && VALID_PLAN_IDS.has(planId)) update.plan = planId;
      else if (planId) {
        webhookSkip(event.type, obj.id, 'unknown_plan_ignored', { planId, companyId });
      }

      await Company.findByIdAndUpdate(companyId, update);

      if (obj.status === 'active' && planId && VALID_PLAN_IDS.has(planId)) {
        await refillCredits(companyId, planId);
      }
      webhookInfo(event.type, obj.id, 'subscription_updated',
        { companyId, status: obj.status, planId: planId || 'unchanged' });
      break;
    }

    // ── customer.subscription.deleted ──────────────────────────────────────
    case 'customer.subscription.deleted': {
      const { companyId } = obj.metadata || {};

      if (!companyId) {
        webhookSkip(event.type, obj.id, 'missing_metadata', { field: 'companyId' });
        break;
      }

      await Company.findByIdAndUpdate(companyId, {
        plan:                 'free',
        stripeSubscriptionId: null,
        subscriptionStatus:   'canceled',
        cancelAtPeriodEnd:    false,
      });
      await refillCredits(companyId, 'free');
      // Notify the account owner
      const deletedCompany = await Company.findById(companyId).select('name email').lean();
      if (deletedCompany) {
        const owner = await User.findOne({ companyId, role: 'owner' }).select('email').lean();
        if (owner) {
          sendSubscriptionCancelled(owner.email, deletedCompany.name, null, `${process.env.CLIENT_URL}/app/billing`);
        }
      }
      webhookInfo(event.type, obj.id, 'subscription_deleted_downgraded', { companyId });
      break;
    }

    // ── invoice.payment_succeeded ───────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      if (!obj.customer) {
        webhookSkip(event.type, obj.id, 'missing_customer_id');
        break;
      }
      const company = await Company.findOne({ stripeCustomerId: obj.customer });
      if (!company) {
        webhookSkip(event.type, obj.id, 'company_not_found', { customer: obj.customer });
        break;
      }
      await refillCredits(company._id, company.plan);
      webhookInfo(event.type, obj.id, 'credits_refilled',
        { companyId: company._id, plan: company.plan });
      break;
    }

    // ── invoice.payment_failed ──────────────────────────────────────────────
    case 'invoice.payment_failed': {
      if (!obj.customer) {
        webhookSkip(event.type, obj.id, 'missing_customer_id');
        break;
      }
      const company = await Company.findOne({ stripeCustomerId: obj.customer });
      if (!company) {
        webhookSkip(event.type, obj.id, 'company_not_found', { customer: obj.customer });
        break;
      }
      await Company.findByIdAndUpdate(company._id, { subscriptionStatus: 'past_due' });
      // Notify the account owner
      const owner = await User.findOne({ companyId: company._id, role: 'owner' }).select('email').lean();
      if (owner) {
        const amount = obj.amount_due ? obj.amount_due / 100 : null;
        sendPaymentFailed(owner.email, company.name, amount, `${process.env.CLIENT_URL}/app/billing`);
      }
      console.warn(`[billing] Payment failed for ${company.email}`);
      webhookInfo(event.type, obj.id, 'marked_past_due', { companyId: company._id });
      break;
    }

    // ── customer.subscription.trial_will_end ────────────────────────────────
    case 'customer.subscription.trial_will_end': {
      if (!obj.customer) {
        webhookSkip(event.type, obj.id, 'missing_customer_id');
        break;
      }
      const trialCompany = await Company.findOne({ stripeCustomerId: obj.customer }).select('name _id').lean();
      if (trialCompany) {
        const trialOwner = await User.findOne({ companyId: trialCompany._id, role: 'owner' }).select('email').lean();
        if (trialOwner) {
          const trialEnd = obj.trial_end ? new Date(obj.trial_end * 1000) : new Date(Date.now() + 3 * 86400000);
          sendTrialEnding(trialOwner.email, trialCompany.name, trialEnd, `${process.env.CLIENT_URL}/app/billing`);
        }
      }
      webhookInfo(event.type, obj.id, 'trial_ending_soon');
      break;
    }
  }
}
