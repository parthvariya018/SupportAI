const mongoose       = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const companySchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  email:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  apiKey: { type: String, default: uuidv4, unique: true, index: true },

  plan: {
    type:    String,
    enum:    ['free', 'starter', 'pro', 'enterprise'],
    default: 'free',
  },

  // ── Usage counters (reset monthly) ───────────────────────────────────────
  usage: {
    messagesThisMonth:  { type: Number, default: 0 },
    tokensThisMonth:    { type: Number, default: 0 },
    inputTokensTotal:   { type: Number, default: 0 },
    outputTokensTotal:  { type: Number, default: 0 },
    documentsCount:     { type: Number, default: 0 },
    apiCallsToday:      { type: Number, default: 0 },
    apiCallsResetAt:    { type: Date,   default: () => new Date() },
    usageResetAt:       { type: Date,   default: () => new Date() },
  },

  // ── AI Credits ────────────────────────────────────────────────────────────
  credits: {
    balance:        { type: Number, default: 0 },   // remaining credits
    totalPurchased: { type: Number, default: 0 },
    totalConsumed:  { type: Number, default: 0 },
    lastTopUpAt:    { type: Date },
  },

  // ── Stripe ────────────────────────────────────────────────────────────────
  stripeCustomerId:     { type: String },
  stripeSubscriptionId: { type: String },
  subscriptionStatus:   {
    type:    String,
    enum:    ['active', 'past_due', 'canceled', 'trialing', 'unpaid', 'incomplete', null],
    default: null,
  },
  currentPeriodEnd:     { type: Date },
  cancelAtPeriodEnd:    { type: Boolean, default: false },
  trialEndsAt:          { type: Date },

  // ── Widget ────────────────────────────────────────────────────────────────
  widgetConfig: {
    primaryColor:   { type: String,  default: '#2563eb' },
    welcomeMessage: { type: String,  default: 'Hi! How can I help you today?' },
    position:       { type: String,  enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
    showLeadForm:   { type: Boolean, default: true },
  },
}, { timestamps: true });

// ── Auto-reset monthly usage ──────────────────────────────────────────────────
companySchema.methods.resetUsageIfNeeded = async function () {
  const now       = new Date();
  const resetDate = new Date(this.usage.usageResetAt);
  const monthDiff = (now.getFullYear() - resetDate.getFullYear()) * 12
                  + (now.getMonth()    - resetDate.getMonth());

  if (monthDiff >= 1) {
    this.usage.messagesThisMonth = 0;
    this.usage.tokensThisMonth   = 0;
    this.usage.apiCallsToday     = 0;
    this.usage.usageResetAt      = now;
    await this.save();
  }
};

companySchema.methods.regenerateApiKey = function () {
  this.apiKey = uuidv4();
  return this.save();
};

module.exports = mongoose.model('Company', companySchema);
