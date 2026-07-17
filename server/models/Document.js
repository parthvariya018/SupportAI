const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  companyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  originalName:  { type: String, required: true, trim: true },
  extractedText: { type: String, required: true },
  charCount:     { type: Number, default: 0 },
  wordCount:     { type: Number, default: 0 },
  pageCount:     { type: Number, default: 0 },
  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Cloud storage fields — null when storage is not configured (dev fallback)
  storageKey:    { type: String, default: null },  // S3/R2 object key for deletion
  storageUrl:    { type: String, default: null },  // Public URL or signed URL base
}, { timestamps: true });

documentSchema.index({ companyId: 1, createdAt: -1 });

// Text index for full-text search across name and content
documentSchema.index(
  { originalName: 'text', extractedText: 'text' },
  { weights: { originalName: 10, extractedText: 1 }, name: 'document_text_search' }
);

module.exports = mongoose.model('Document', documentSchema);
