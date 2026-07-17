const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  companyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  name:           { type: String, required: [true, 'Name is required'], trim: true },
  email:          {
    type:      String,
    required:  [true, 'Email is required'],
    lowercase: true,
    trim:      true,
    match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
  },
  phone:   { type: String, trim: true },
  message: { type: String, trim: true },
}, { timestamps: true });

leadSchema.index({ companyId: 1, createdAt: -1 });
leadSchema.index({ companyId: 1, email: 1 });

module.exports = mongoose.model('Lead', leadSchema);
