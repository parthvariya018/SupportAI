// server/middleware/apiKeyAuth.js
// Authenticates widget requests via x-api-key header.
// Attaches req.company and req.companyId — no business logic.

'use strict';

const Company  = require('../models/Company');
const AppError = require('../utils/AppError');

// MongoDB projection — load only what downstream needs
const COMPANY_PROJECTION = {
  _id:                  1,
  name:                 1,
  apiKey:               1,
  plan:                 1,
  subscriptionStatus:   1,
  systemPrompt:         1,
  instructions:         1,
  widgetConfig:         1,
  usage:                1,
  credits:              1,
};

/**
 * Determines whether a company account is effectively disabled.
 * No `isActive` flag on the model — derive from subscriptionStatus.
 * Free-plan companies are always active.
 *
 * @param {object} company - Mongoose lean document
 * @returns {boolean}
 */
function isDisabled(company) {
  if (company.plan === 'free') return false;
  const blocked = new Set(['canceled', 'unpaid', 'incomplete']);
  return blocked.has(company.subscriptionStatus);
}

/**
 * Express middleware — API key authentication for widget endpoints.
 *
 * Reads:   x-api-key header
 * Attaches: req.company, req.companyId
 * Errors:
 *   401 — missing or invalid API key
 *   403 — account disabled
 *   404 — company not found
 */
async function apiKeyAuth(req, res, next) {
  try {
    // 1. Extract
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return next(new AppError('API key is required. Pass it in the x-api-key header.', 401, 'MISSING_API_KEY'));
    }

    // 2. DB lookup
    const company = await Company.findOne(
      { apiKey: apiKey.trim() },
      COMPANY_PROJECTION
    ).lean();

    // 3. Guards
    if (!company) {
      return next(new AppError('Invalid API key.', 401, 'INVALID_API_KEY'));
    }

    if (isDisabled(company)) {
      return next(new AppError('This account is disabled. Please check your subscription.', 403, 'ACCOUNT_DISABLED'));
    }

    // 4. Attach
    req.company   = company;
    req.companyId = company._id.toString();

    // 5. Continue
    return next();

  } catch (err) {
    return next(err);
  }
}

module.exports = apiKeyAuth;
