const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title:     { type: String, required: true, trim: true },
  slug:      { type: String, required: true },
  content:   { type: String, required: true },
  category:  { type: String, default: 'General' },
  tags:      [String],
  status:    { type: String, enum: ['draft', 'published'], default: 'draft' },
  author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  views:     { type: Number, default: 0 },
  helpful:   { type: Number, default: 0 },
  notHelpful:{ type: Number, default: 0 },
}, { timestamps: true });

articleSchema.index({ companyId: 1, status: 1 });
articleSchema.index({ companyId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Article', articleSchema);
