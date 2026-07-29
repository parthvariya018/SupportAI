// server/bootstrap/createChatModule.js
// Composition root for the entire chatbot module.
// The ONLY file that instantiates ChatService, controllers, and the chat router.
// No business logic. No I/O. No env reads. No Express app creation.

'use strict';

// ── Leaf nodes (no dependencies) ──────────────────────────────────────────────
const historyService   = require('../services/historyService');
const contextService   = require('../services/contextService');
const promptService    = require('../services/promptService');
const AIProviderFactory = require('../services/ai/AIProviderFactory');
const apiKeyAuth       = require('../middleware/apiKeyAuth');

// ── Mid nodes ─────────────────────────────────────────────────────────────────
const ChatService              = require('../services/chatService');

// ── Top nodes ─────────────────────────────────────────────────────────────────
const makeChatController       = require('../controllers/chatController');
const makeStreamChatController = require('../controllers/streamChatController');
const makeChatRouter           = require('../routes/chatRoutes');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the entire chat module and returns the configured router.
 *
 * Usage in server.js:
 *   const { router } = require('./bootstrap/createChatModule')();
 *   app.use('/api/chat', widgetCors, chatLimiter, router);  // single mount point
 *
 * @returns {{
 *   router:      import('express').Router,
 *   chatService: InstanceType<typeof ChatService>,   // exposed for testing only
 * }}
 */
function createChatModule() {

  // 1. ChatService — depends on all four leaf services
  const chatService = new ChatService({
    historyService,
    contextService,
    promptService,
    AIProviderFactory,
    // usageService: null,  // wire here when usageService is ready
    // logger:       null,  // wire here when structured logger is added
  });

  // 2. Controllers — depend only on chatService
  const chatController       = makeChatController(chatService);
  const streamChatController = makeStreamChatController(chatService);

  // 3. Router — depends on controllers + apiKeyAuth + AIProviderFactory (for /health)
  const router = makeChatRouter({ chatService, AIProviderFactory });

  return {
    router,
    chatService,   // exposed for integration tests — not for production use
  };
}

module.exports = createChatModule;
