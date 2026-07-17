const express = require('express');
const router  = express.Router();
const {
  getPlans, getSubscription, getUsage,
  createCheckoutSession, upgradeSubscription,
  cancelSubscription, reactivateSubscription,
  topUpCredits, createPortalSession,
  getInvoices, handleWebhook,
} = require('../controllers/billingController');
const { protect, restrictTo } = require('../middleware/auth');

// ── Stripe webhook — raw body BEFORE express.json() ──────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

router.use(protect);

// Public to all authenticated users
router.get('/plans',        getPlans);
router.get('/subscription', getSubscription);
router.get('/usage',        getUsage);

// Owner / admin only
router.post('/subscribe',   restrictTo('owner', 'admin'), createCheckoutSession);
router.post('/upgrade',     restrictTo('owner', 'admin'), upgradeSubscription);
router.post('/cancel',      restrictTo('owner', 'admin'), cancelSubscription);
router.post('/reactivate',  restrictTo('owner', 'admin'), reactivateSubscription);
router.post('/portal',      restrictTo('owner', 'admin'), createPortalSession);
router.post('/credits/topup', restrictTo('owner', 'admin'), topUpCredits);
router.get('/invoices',     restrictTo('owner', 'admin'), getInvoices);

module.exports = router;
