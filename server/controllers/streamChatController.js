// server/controllers/streamChatController.js
// Thin SSE controller — sets headers, forwards chunks, handles disconnect.
// No business logic, no DB, no prompt building, no provider selection.

'use strict';

const AppError = require('../utils/AppError');

const REQUIRED_BODY_FIELDS = ['sessionId', 'message'];

// ─── SSE helpers ──────────────────────────────────────────────────────────────
function writeChunk(res, data)  { res.write(`data: ${JSON.stringify(data)}\n\n`); }
function writeDone(res)         { res.write(`data: [DONE]\n\n`); }
function writeError(res, msg)   { res.write(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`); }

// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * @param {import('../services/chatService')} chatService
 */
function makeStreamChatController(chatService) {

  /**
   * POST /api/chat/stream
   * Auth: apiKeyAuth middleware must attach req.company before this runs.
   */
  async function streamMessage(req, res, next) {

    // 1. Validate — before headers, so next(err) still works
    for (const field of REQUIRED_BODY_FIELDS) {
      if (!req.body?.[field]?.toString().trim()) {
        return next(new AppError(`Missing required field: "${field}"`, 400, 'MISSING_FIELD'));
      }
    }
    if (!req.company) {
      return next(new AppError('Company context missing — check API key middleware', 500, 'MISSING_COMPANY'));
    }

    // 2. SSE headers — no turning back after this point
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    // 3. Abort signal — fires when client disconnects
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    // 4. Build payload
    const payload = {
      companyId:   req.company._id.toString(),
      sessionId:   req.body.sessionId.trim(),
      userMessage: req.body.message.trim(),
      company:     req.company,
      settings:    req.body.settings    || {},
      historyOpts: req.body.historyOpts || {},
      signal:      abort.signal,
    };

    // 5. Stream — callbacks forward chunks directly to res
    try {
      await chatService.processStreamMessage(payload, {
        onChunk: (text)  => { if (!abort.signal.aborted) writeChunk(res, { chunk: text }); },
        onDone:  (meta)  => { writeDone(res); res.end(); },
        onError: (err)   => { writeError(res, err.message || 'Stream error'); res.end(); },
      });
    } catch (err) {
      // processStreamMessage threw before any chunk — stream may or may not have started
      if (!res.headersSent) return next(err);
      writeError(res, err.message || 'Unexpected stream error');
      res.end();
    }
  }

  return { streamMessage };
}

module.exports = makeStreamChatController;
