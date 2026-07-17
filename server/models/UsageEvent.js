const mongoose = require('mongoose');
const { getDefaultModel } = require('../config/modelRegistry');

const usageEventSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId:   { type: String },

  type: {
    type: String,
    enum: ['chat_message', 'ai_response', 'document_upload', 'api_call'],
    required: true,
  },

  // Token tracking
  inputTokens:  { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens:  { type: Number, default: 0 },

  // Credit tracking (1 credit = 1 AI message exchange)
  creditsUsed:  { type: Number, default: 0 },

  // Cost in USD (micro-dollars stored as integers: $0.001 = 1)
  costUsd:      { type: Number, default: 0 },

  model:        { type: String, default: () => getDefaultModel('free').id },
  requestedModel:   { type: String },
  actualModelUsed:  { type: String },
  provider:         { type: String },
  metadata:     { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
});

usageEventSchema.index({ companyId: 1, createdAt: -1 });
usageEventSchema.index({ companyId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('UsageEvent', usageEventSchema);
