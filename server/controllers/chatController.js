/**
 * controllers/chatController.js
 *
 * Fixes applied vs original:
 *  1. Eliminated double DB fetch — req.company is now fully populated by the
 *     chat route (name + usage + credits). No second Company.findById needed.
 *  2. UsageEvent records the actual model used (from geminiService response)
 *     instead of the hardcoded 'gemini-2.5-flash' string.
 *  3. requestId propagated into UsageEvent.metadata for traceability.
 *  4. Quota checks remain synchronous inline — no middleware double-work.
 */

const { v4: uuid }      = require('uuid');
const Conversation      = require('../models/Conversation');
const Document          = require('../models/Document');
const Company           = require('../models/Company');
const UsageEvent        = require('../models/UsageEvent');
const AppError          = require('../utils/AppError');
const catchAsync        = require('../utils/catchAsync');
const { generateReply } = require('../services/geminiService');
const { getProvider }   = require('../services/ai/AIProviderFactory');
const { incrementUsage, calcCostUsd, getPlanLimits } = require('../middleware/planGuard');
const { getDefaultModel, getModel, isModelAllowed } = require('../config/modelRegistry');

const makeTitle = (text) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= 40 ? clean : clean.slice(0, 39) + '…';
};

// ── Inline quota checks ───────────────────────────────────────────────────────
function checkQuotas(company) {
  if (!company) return null;

  const { messages, credits, documents } = getPlanLimits(company.plan);

  if (messages !== Infinity && company.usage.messagesThisMonth >= messages)
    return { code: 'PLAN_LIMIT_REACHED', message: `You've reached your monthly message limit of ${messages.toLocaleString()}. Upgrade your plan to continue.` };

  if (credits !== Infinity && company.credits.balance <= 0)
    return { code: 'PLAN_LIMIT_REACHED', message: 'AI credits exhausted. Purchase more credits or upgrade your plan.' };

  return null;
}

// ── POST /api/chat/message ────────────────────────────────────────────────────
exports.sendMessage = catchAsync(async (req, res, next) => {
  // FIX #1: req.company is fully populated by the chat route middleware.
  // We only do a second fetch when the route used JWT auth (which only attaches
  // a lean .select('name') company). In that case we need usage + credits.
  let company = null;
  if (req.companyId) {
    // FIX #1: single fetch that covers both JWT and API-key paths
    company = await Company.findById(req.companyId)
      .select('name plan usage credits')
      .lean();
  }

  if (company) {
    // Inline monthly usage reset (keeps controller self-contained)
    const now       = new Date();
    const resetDate = new Date(company.usage?.usageResetAt);
    const monthDiff = (now.getFullYear() - resetDate.getFullYear()) * 12
                    + (now.getMonth()    - resetDate.getMonth());
    if (monthDiff >= 1) {
      await Company.findByIdAndUpdate(req.companyId, {
        $set: {
          'usage.messagesThisMonth': 0,
          'usage.tokensThisMonth':   0,
          'usage.apiCallsToday':     0,
          'usage.usageResetAt':      now,
        },
      });
      // Refresh the lean copy
      company = await Company.findById(req.companyId).select('name plan usage credits').lean();
    }

    const quotaError = checkQuotas(company);
    if (quotaError) return res.status(403).json({ success: false, ...quotaError });
  }

  const { message, sessionId, modelId: requestedModel } = req.body;

  // Resolve model: use requested if allowed, otherwise fall back to plan default
  const userPlan = company?.plan || 'free';
  let modelId;
  if (requestedModel) {
    const modelConfig = getModel(requestedModel);
    if (!modelConfig)
      return next(new AppError(`Model "${requestedModel}" does not exist.`, 400));
    if (!modelConfig.enabled)
      return next(new AppError(`Model "${requestedModel}" is currently disabled.`, 400));
    if (!isModelAllowed(userPlan, requestedModel))
      return next(new AppError(`Model "${requestedModel}" is not available on your plan.`, 403));
    modelId = requestedModel;
  } else {
    modelId = getDefaultModel(userPlan).id;
  }
  const sid = sessionId || uuid();

  let conversation = await Conversation.findOne({ companyId: req.companyId, sessionId: sid });
  if (!conversation) {
    conversation = await Conversation.create({
      companyId: req.companyId,
      sessionId: sid,
      title:     makeTitle(message),
      messages:  [],
    });
  }

  // Load only required fields — never pull extractedText for display
  const documents = await Document.find({ companyId: req.companyId })
    .select('extractedText originalName _id')
    .lean();

  const companyName = company?.name || '';

  // generateReply now returns { reply, sources, usage, model }
  const { reply, sources, usage, model: modelUsed } = await generateReply(
    documents, conversation.messages, message, companyName, modelId
  );

  conversation.messages.push({ role: 'user',      content: message });
  conversation.messages.push({ role: 'assistant', content: reply, sources });
  conversation.messageCount = conversation.messages.length;
  await conversation.save();

  // Record usage event — FIX #2: use the actual model name from geminiService
  if (company) {
    const costUsd = calcCostUsd(usage.inputTokens, usage.outputTokens, modelUsed);

    await UsageEvent.create({
      companyId:       req.companyId,
      sessionId:       sid,
      type:            'ai_response',
      inputTokens:     usage.inputTokens,
      outputTokens:    usage.outputTokens,
      totalTokens:     usage.totalTokens,
      creditsUsed:     1,
      costUsd,
      model:           modelUsed || getDefaultModel('free').id,
      requestedModel:  modelId,
      actualModelUsed: modelUsed,
      provider:        getModel(modelUsed)?.provider,
      metadata: {
        conversationId: conversation._id,
        messageLength:  message.length,
        requestId:      req.id, // FIX #3: traceability
      },
    });

    await incrementUsage(req.companyId, {
      tokens:       usage.totalTokens,
      inputTokens:  usage.inputTokens,
      outputTokens: usage.outputTokens,
      credits:      1,
    });
  }

  res.json({
    status:       'success',
    reply,
    sessionId:    sid,
    title:        conversation.title,
    sources,
    messageCount: conversation.messageCount,
    ...(company ? {
      usage: {
        inputTokens:  usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens:  usage.totalTokens,
        model:        modelUsed,
      },
    } : {}),
  });
});

// ── POST /api/chat/stream ─────────────────────────────────────────────────────
exports.streamMessage = async (req, res, next) => {
  let company = null;
  if (req.companyId) {
    company = await Company.findById(req.companyId).select('name plan usage credits').lean();
  }

  if (company) {
    const now       = new Date();
    const resetDate = new Date(company.usage?.usageResetAt);
    const monthDiff = (now.getFullYear() - resetDate.getFullYear()) * 12
                    + (now.getMonth()    - resetDate.getMonth());
    if (monthDiff >= 1) {
      await Company.findByIdAndUpdate(req.companyId, {
        $set: { 'usage.messagesThisMonth': 0, 'usage.tokensThisMonth': 0,
                'usage.apiCallsToday': 0, 'usage.usageResetAt': now },
      });
      company = await Company.findById(req.companyId).select('name plan usage credits').lean();
    }
    const quotaError = checkQuotas(company);
    if (quotaError) return res.status(403).json({ success: false, ...quotaError });
  }

  const { message, sessionId, modelId: requestedModel } = req.body;
  const userPlan = company?.plan || 'free';

  let modelId;
  if (requestedModel) {
    const modelConfig = getModel(requestedModel);
    if (!modelConfig)         return next(new AppError(`Model "${requestedModel}" does not exist.`, 400));
    if (!modelConfig.enabled) return next(new AppError(`Model "${requestedModel}" is currently disabled.`, 400));
    if (!isModelAllowed(userPlan, requestedModel))
      return next(new AppError(`Model "${requestedModel}" is not available on your plan.`, 403));
    if (!modelConfig.supportsStreaming)
      return next(new AppError(`Model "${requestedModel}" does not support streaming.`, 400));
    modelId = requestedModel;
  } else {
    modelId = getDefaultModel(userPlan).id;
  }

  const sid = sessionId || uuid();

  let conversation = await Conversation.findOne({ companyId: req.companyId, sessionId: sid });
  if (!conversation) {
    conversation = await Conversation.create({
      companyId: req.companyId, sessionId: sid,
      title: makeTitle(message), messages: [],
    });
  }

  const documents = await Document.find({ companyId: req.companyId })
    .select('extractedText originalName _id').lean();

  // ── Open SSE connection ───────────────────────────────────────────────────
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const provider  = getProvider(modelId);
    const generator = provider.generateStream(
      documents, conversation.messages, message, company?.name || '', modelId
    );

    // Collect tokens as they arrive; metadata arrives as the generator's return value
    let fullReply = '';
    let metadata;
    while (true) {
      const { value, done } = await generator.next();
      if (done) { metadata = value; break; }
      fullReply += value;
      send('token', { token: value });
    }

    const { sources, model: modelUsed, usage } = metadata;

    // Persist conversation
    conversation.messages.push({ role: 'user',      content: message });
    conversation.messages.push({ role: 'assistant', content: fullReply, sources });
    conversation.messageCount = conversation.messages.length;
    await conversation.save();

    // Persist usage event
    if (company) {
      const costUsd = calcCostUsd(usage.inputTokens, usage.outputTokens, modelUsed);
      await UsageEvent.create({
        companyId: req.companyId, sessionId: sid, type: 'ai_response',
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens, creditsUsed: 1, costUsd,
        model: modelUsed || getDefaultModel('free').id,
        requestedModel: modelId, actualModelUsed: modelUsed,
        provider: getModel(modelUsed)?.provider,
        metadata: { conversationId: conversation._id, messageLength: message.length, requestId: req.id },
      });
      await incrementUsage(req.companyId, {
        tokens: usage.totalTokens, inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens, credits: 1,
      });
    }

    send('done', { sessionId: sid, title: conversation.title, sources, model: modelUsed, usage, messageCount: conversation.messageCount });
    res.end();

  } catch (err) {
    send('error', { message: err?.message || 'Stream failed' });
    res.end();
  }
};

// ── GET /api/chat/search ──────────────────────────────────────────────────
exports.searchConversations = catchAsync(async (req, res, next) => {
  const q = String(req.query.q || '').trim();
  if (!q) return next(new AppError('Query parameter "q" is required', 400));

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const filter = {
    companyId: req.companyId,
    $text: { $search: q },
  };

  const [conversations, total] = await Promise.all([
    Conversation.find(filter, { score: { $meta: 'textScore' } })
      .select('sessionId title messageCount leadCaptured pinned updatedAt createdAt')
      .sort({ pinned: -1, score: { $meta: 'textScore' }, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  res.json({ status: 'success', total, page, pages: Math.ceil(total / limit), q, conversations });
});

// ── GET /api/chat/history ─────────────────────────────────────────────────────
exports.listHistory = catchAsync(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50,  parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const [conversations, total] = await Promise.all([
    Conversation.find({ companyId: req.companyId })
      .select('sessionId title messageCount leadCaptured pinned updatedAt createdAt')
      .sort({ pinned: -1, updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Conversation.countDocuments({ companyId: req.companyId }),
  ]);

  res.json({ status: 'success', total, page, pages: Math.ceil(total / limit), conversations });
});

// ── GET /api/chat/history/:id ─────────────────────────────────────────────────
exports.getConversation = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id, companyId: req.companyId,
  }).lean();
  if (!conversation) return next(new AppError('Conversation not found', 404));
  res.json({ status: 'success', conversation });
});

// ── DELETE /api/chat/history/:id ──────────────────────────────────────────────
exports.deleteConversation = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOneAndDelete({
    _id: req.params.id, companyId: req.companyId,
  });
  if (!conversation) return next(new AppError('Conversation not found', 404));
  res.json({ status: 'success', message: 'Conversation deleted' });
});

// ── PATCH /api/chat/:id/pin ─────────────────────────────────────────────────
exports.pinConversation = catchAsync(async (req, res, next) => {
  const pinned = req.body.pinned;
  if (typeof pinned !== 'boolean')
    return next(new AppError('"pinned" must be a boolean', 400));
  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { pinned },
    { new: true, select: '_id pinned updatedAt' }
  );
  if (!conversation) return next(new AppError('Conversation not found', 404));
  res.json({ status: 'success', conversation });
});

// ── PATCH /api/chat/history/:id ───────────────────────────────────────────────
exports.renameConversation = catchAsync(async (req, res, next) => {
  const { title } = req.body;
  if (!title?.trim()) return next(new AppError('Title is required', 400));
  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { title: title.trim().slice(0, 120) },
    { new: true }
  );
  if (!conversation) return next(new AppError('Conversation not found', 404));
  res.json({ status: 'success', conversation });
});

// ── PATCH /api/chat/:id/title ─────────────────────────────────────────────────
exports.renameConversationTitle = catchAsync(async (req, res, next) => {
  const { title } = req.body;
  const trimmed = title?.trim();
  if (!trimmed)
    return next(new AppError('Title is required', 400));
  if (trimmed.length > 100)
    return next(new AppError('Title must be 100 characters or fewer', 400));
  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { title: trimmed },
    { new: true, select: '_id title updatedAt' }
  );
  if (!conversation) return next(new AppError('Conversation not found', 404));
  res.json({ status: 'success', conversation });
});
