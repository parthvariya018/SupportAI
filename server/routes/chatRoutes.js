// server/routes/chatRoutes.js
// Express router factory for all /api/chat/* endpoints.
// Accepts fully-constructed controllers via dependency injection — no direct imports.

'use strict';

const { Router }                       = require('express');
const { protect }                      = require('../middleware/auth');
const { validate }                     = require('../middleware/validate');
const { planMeetsRequirement, MODELS } = require('../config/modelRegistry');
const AppError                         = require('../utils/AppError');

/**
 * Dual-auth middleware: accepts either a Bearer JWT (dashboard) or x-api-key (widget).
 * Attaches req.company / req.companyId regardless of which path is taken.
 */
function makeChatAuth(apiKeyAuth) {
  return (req, res, next) => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      protect(req, res, async (err) => {
        if (err) return next(err);
        try {
          const Company = require('../models/Company');
          req.company = await Company.findById(req.companyId).select('name').lean();
        } catch { /* non-fatal */ }
        next();
      });
    } else {
      apiKeyAuth(req, res, next);
    }
  };
}

/**
 * @param {object} deps
 * @param {{ sendMessage: Function }}   deps.chatController
 * @param {{ streamMessage: Function }} deps.streamChatController
 * @param {Function}                    deps.apiKeyAuth
 * @param {{ healthCheckAll: Function, getProvider: Function }} deps.AIProviderFactory
 * @returns {Router}
 */
function makeChatRouter({ chatController, streamChatController, apiKeyAuth, AIProviderFactory }) {
  const router   = Router();
  const chatAuth = makeChatAuth(apiKeyAuth);

  // ── Widget + Dashboard (dual auth) ────────────────────────────────────────
  router.post('/message', chatAuth, validate(['message']), chatController.sendMessage);
  router.post('/stream',  chatAuth, validate(['message']), streamChatController.streamMessage);

  // ── Dashboard only (JWT) ──────────────────────────────────────────────────
  router.get('/search',         protect, (req, res, next) => {
    // search is handled via listHistory with a query param
    req.query.search = req.query.q || req.query.search || '';
    next();
  }, _listHistory);
  router.get('/history',        protect, _listHistory);
  router.get('/history/:id',    protect, _getConversation);
  router.delete('/history/:id', protect, _deleteConversation);
  router.patch('/history/:id',  protect, validate(['title']), _renameConversation);
  router.patch('/:id/title',    protect, validate(['title']), _renameConversation);
  router.patch('/:id/pin',      protect, _pinConversation);

  // ── Public utility ────────────────────────────────────────────────────────
  router.get('/health', async (_req, res, next) => {
    try {
      const providers = AIProviderFactory
        ? await AIProviderFactory.healthCheckAll()
        : {};
      res.json({
        status:   'ok',
        providers,
        uptime:   Math.round(process.uptime()),
        version:  process.env.npm_package_version || '1.0.0',
      });
    } catch (err) { next(err); }
  });

  router.get('/models', apiKeyAuth, (req, res) => {
    const plan    = req.company?.plan || 'free';
    const allowed = Object.entries(MODELS)
      .filter(([, m]) => m.enabled && planMeetsRequirement(plan, m.minimumPlan))
      .map(([id, m]) => ({
        id,
        displayName:     m.displayName,
        provider:        m.provider,
        contextWindow:   m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        streaming:       m.streaming,
      }));
    res.json({ success: true, data: { plan, models: allowed } });
  });

  return router;
}

// ── Inline history handlers (no separate controller needed — thin DB ops) ─────

const catchAsync = require('../utils/catchAsync');
const Conversation = require('../models/Conversation');

const _listHistory = catchAsync(async (req, res) => {
  const filter = { companyId: req.companyId };
  if (req.query.search) {
    filter['messages.content'] = { $regex: req.query.search, $options: 'i' };
  }
  const conversations = await Conversation.find(filter)
    .select('sessionId messageCount createdAt updatedAt pinned title')
    .sort({ pinned: -1, updatedAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: conversations });
});

const _getConversation = catchAsync(async (req, res, next) => {
  const doc = await Conversation.findOne({
    _id: req.params.id, companyId: req.companyId,
  }).lean();
  if (!doc) return next(new AppError('Conversation not found', 404));
  res.json({ success: true, data: doc });
});

const _deleteConversation = catchAsync(async (req, res, next) => {
  const doc = await Conversation.findOneAndDelete({
    _id: req.params.id, companyId: req.companyId,
  });
  if (!doc) return next(new AppError('Conversation not found', 404));
  res.json({ success: true, message: 'Conversation deleted' });
});

const _renameConversation = catchAsync(async (req, res, next) => {
  const doc = await Conversation.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { title: req.body.title.trim() },
    { new: true }
  ).lean();
  if (!doc) return next(new AppError('Conversation not found', 404));
  res.json({ success: true, data: doc });
});

const _pinConversation = catchAsync(async (req, res, next) => {
  const doc = await Conversation.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!doc) return next(new AppError('Conversation not found', 404));
  doc.pinned = !doc.pinned;
  await doc.save();
  res.json({ success: true, data: { pinned: doc.pinned } });
});

module.exports = makeChatRouter;
