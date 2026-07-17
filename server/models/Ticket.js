const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, required: true },
  status:      { type: String, enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'], default: 'open' },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedBy:  { name: String, email: String },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  tags:        [{ type: String }],
  notes: [{
    content:     { type: String, required: true },
    author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isInternal:  { type: Boolean, default: true },
    createdAt:   { type: Date, default: Date.now },
  }],
  timeline: [{
    action:      String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note:        String,
    createdAt:   { type: Date, default: Date.now },
  }],
  dueDate:     { type: Date },
  resolvedAt:  { type: Date },
  closedAt:    { type: Date },
}, { timestamps: true });

ticketSchema.index({ companyId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ companyId: 1, assignedTo: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
