// server/routes/chatRoutes.js
// Express router for all /api/chat/* endpoints.
// No business logic — only route registration.

'use strict';

const { Router }                       = require('express');
const { planMeetsRequirement, MODELS } = require('../config/modelRegistry');
const apiKeyAuth                       = require('../middleware/apiKeyAuth');
const makeChatController               = require('../controllers/chatController');
const makeStreamChatController         = require('../controllers/streamChatController');
const AppError                         = require('../utils/AppError');

// ─── Router factory ───────────────────────────────────────────────────────────
/**
 * @param {object} deps
 * @param {import('../services/chatService')} deps.chatService
 * @param {object} deps.AIProviderFactory   - must expose healthCheckAll()
 * @returns {Router}
 */
function makeChatRouter({ chatService, AIProviderFactory }) {
  const router = Router();
  const { sendMessage }   = makeChatController(chatService);
  const { streamMessage } = makeStreamChatController(chatService);

  // POST /api/chat/message
  router.post('/message', apiKeyAuth, sendMessage);

  // POST /api/chat/stream
  router.post('/stream', apiKeyAuth, streamMessage);

  // GET /api/chat/health — public, no apiKeyAuth
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
    } catch (err) {
      next(err);
    }
  });

  // GET /api/chat/models — returns only models allowed for the company's plan
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

module.exports = makeChatRouter;
