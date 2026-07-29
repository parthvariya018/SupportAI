// server/controllers/chatController.js
// Thin controller — no business logic, no DB, no AI, no prompt building.

'use strict';

const AppError = require('../utils/AppError');

// Required fields from the request body
const REQUIRED_BODY_FIELDS = ['sessionId', 'message'];

/**
 * Factory — returns controller bound to an injected chatService instance.
 * Instantiate once at app startup; pass into the router.
 *
 * @param {import('../services/chatService')} chatService
 */
function makeChatController(chatService) {

  /**
   * POST /api/chat/message
   * Auth: API key middleware must attach req.company before this runs.
   */
  async function sendMessage(req, res, next) {
    try {
      // 1. Validate required body fields
      for (const field of REQUIRED_BODY_FIELDS) {
        if (!req.body?.[field]?.toString().trim()) {
          return next(new AppError(`Missing required field: "${field}"`, 400, 'MISSING_FIELD'));
        }
      }

      // 2. company is attached by API-key auth middleware
      if (!req.company) {
        return next(new AppError('Company context missing — check API key middleware', 500, 'MISSING_COMPANY'));
      }

      // 3. Call ChatService
      const result = await chatService.processMessage({
        companyId:   req.company._id.toString(),
        sessionId:   req.body.sessionId.trim(),
        userMessage: req.body.message.trim(),
        company:     req.company,
        settings:    req.body.settings   || {},
        historyOpts: req.body.historyOpts || {},
      });

      // 4. Respond
      return res.status(200).json({
        success: true,
        data: {
          reply:     result.reply,
          sources:   result.sources,
          usage:     result.usage,
          model:     result.model,
          latency:   result.latency,
          requestId: result.requestId,
        },
      });

    } catch (err) {
      // 5. Forward to Express error middleware
      return next(err);
    }
  }

  return { sendMessage };
}

module.exports = makeChatController;
