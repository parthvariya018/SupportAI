// server/bootstrap/createChatModule.js
// Composition root for the entire chatbot module.
// The ONLY file that instantiates ChatService, controllers, and the chat router.

'use strict';

const historyService        = require('../services/historyService');
const contextService        = require('../services/contextService');
const promptService         = require('../services/promptService');
const AIProviderFactory     = require('../services/ai/AIProviderFactory');
const apiKeyAuth            = require('../middleware/apiKeyAuth');

const ChatService              = require('../services/chatService');
const makeChatController       = require('../controllers/chatController');
const makeStreamChatController = require('../controllers/streamChatController');
const makeChatRouter           = require('../routes/chatRoutes');

/**
 * Wires the entire chat module and returns the configured router.
 *
 * Usage in server.js:
 *   const { router } = createChatModule();
 *   app.use('/api/chat', widgetCors, chatLimiter, router);
 *
 * @returns {{ router: import('express').Router, chatService: ChatService }}
 */
function createChatModule() {
  // 1. Service — depends on all leaf services
  const chatService = new ChatService({
    historyService,
    contextService,
    promptService,
    AIProviderFactory,
  });

  // 2. Controllers — depend only on chatService
  const chatController       = makeChatController(chatService);
  const streamChatController = makeStreamChatController(chatService);

  // 3. Router — receives fully-constructed controllers + middleware
  const router = makeChatRouter({
    chatController,
    streamChatController,
    apiKeyAuth,
    AIProviderFactory,
  });

  return { router, chatService };
}

module.exports = createChatModule;
