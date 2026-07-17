const router = require('express').Router();
const {
  sendMessage, streamMessage, listHistory, getConversation,
  deleteConversation, renameConversation, renameConversationTitle,
  searchConversations, pinConversation,
} = require('../controllers/chatController');
const { protect }         = require('../middleware/auth');
const { resolveByApiKey } = require('../middleware/apiKey');
const { validate }        = require('../middleware/validate');

/**
 * Dual auth middleware.
 *
 * Root-cause fix: the previous version called protect(req, res, asyncCb),
 * passing an async function as Express's `next`. When protect internally
 * called next(), it ran asyncCb which then called the real next() — causing
 * a double-next that corrupted the middleware chain and produced 401s on
 * valid JWT requests from the dashboard.
 *
 * Fix: inspect the header synchronously first, then delegate to the correct
 * middleware directly without wrapping it in a callback.
 */
const chatAuth = (req, res, next) => {
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');
  if (hasBearer) {
    // JWT path — protect will populate req.user and req.companyId
    protect(req, res, async (err) => {
      if (err) return next(err);
      // Attach req.company (needed by geminiService for the system prompt)
      try {
        const Company = require('../models/Company');
        req.company = await Company.findById(req.companyId).select('name').lean();
      } catch { /* non-fatal — company name just won't appear in prompt */ }
      next();
    });
  } else {
    // API key path — widget / external consumers
    resolveByApiKey(req, res, next);
  }
};

// Public + Dashboard — accepts both Bearer JWT and x-api-key
router.post('/message', chatAuth, validate(['message']), sendMessage);
router.post('/stream',  chatAuth, validate(['message']), streamMessage);

// Authenticated — dashboard only
router.get('/search',         protect, searchConversations);
router.get('/history',        protect, listHistory);
router.get('/history/:id',    protect, getConversation);
router.delete('/history/:id', protect, deleteConversation);
router.patch('/history/:id',  protect, validate(['title']), renameConversation);
router.patch('/:id/title',    protect, validate(['title']), renameConversationTitle);
router.patch('/:id/pin',      protect, pinConversation);

module.exports = router;
