const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  documentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  originalName: { type: String },
  snippet:      { type: String },   // short excerpt used as context
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  sources:   [sourceSchema],        // only populated on assistant messages
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  sessionId:    { type: String, required: true },
  title:        { type: String, default: 'New conversation', maxlength: 120 },
  messages:     [messageSchema],
  messageCount: { type: Number, default: 0 },
  leadCaptured: { type: Boolean, default: false },
  pinned:       { type: Boolean, default: false, index: true },
  archived:     { type: Boolean, default: false, index: true },
}, { timestamps: true });

conversationSchema.index({ companyId: 1, sessionId: 1 }, { unique: true });
conversationSchema.index({ companyId: 1, updatedAt: -1 });
conversationSchema.index({ title: 'text', 'messages.content': 'text' }, { default_language: 'english' });

module.exports = mongoose.model('Conversation', conversationSchema);
