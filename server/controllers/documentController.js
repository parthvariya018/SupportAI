const Document   = require('../models/Document');
const Company    = require('../models/Company');
const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { extractFromBuffer } = require('../services/pdfService');
const { getPlanLimits } = require('../middleware/planGuard');
const { uploadToStorage, deleteFromStorage, isStorageConfigured } = require('../services/storageService');

// POST /api/documents
exports.upload = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No PDF file uploaded', 400));

  // ── Enforce plan document limit ───────────────────────────────────────────
  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  const { documents: docLimit } = getPlanLimits(company.plan);
  const currentCount = await Document.countDocuments({ companyId: req.companyId });

  if (docLimit !== Infinity && currentCount >= docLimit) {
    return res.status(403).json({
      success: false,
      code:    'PLAN_LIMIT_REACHED',
      message: `Document limit reached. Your ${company.plan} plan allows ${docLimit} document${docLimit === 1 ? '' : 's'}. Upgrade your plan to upload more.`,
    });
  }

  // ── Extract text from buffer (before upload — fail fast if PDF is unreadable) ─
  const { text, pageCount, wordCount } = await extractFromBuffer(req.file.buffer);
  if (!text) return next(new AppError('Could not extract text from this PDF', 422));

  // ── Upload to cloud storage ───────────────────────────────────────────────
  // Upload BEFORE creating the DB record so we never save a record that
  // points to a non-existent object. If the upload fails, next(err) is
  // called and no DB record is created — no orphan records.
  let storageKey = null;
  let storageUrl = null;

  if (isStorageConfigured()) {
    try {
      ({ key: storageKey, url: storageUrl } = await uploadToStorage(
        req.file.buffer,
        req.companyId,
        req.file.sanitizedName,
        req.file.mimetype
      ));
    } catch (storageErr) {
      console.error('[storage] Upload failed:', storageErr.message);
      return next(new AppError('Failed to upload file to storage. Please try again.', 502));
    }
  }

  // ── Create DB record ──────────────────────────────────────────────────────
  // If Document.create() throws after a successful upload, we delete the
  // cloud object to avoid orphaned storage objects.
  let doc;
  try {
    doc = await Document.create({
      companyId:    req.companyId,
      originalName: req.file.sanitizedName,
      extractedText: text,
      charCount:    text.length,
      wordCount,
      pageCount,
      uploadedBy:   req.user._id,
      storageKey,
      storageUrl,
    });
  } catch (dbErr) {
    // Rollback: delete the cloud object so it doesn't become orphaned
    if (storageKey) {
      deleteFromStorage(storageKey).catch((e) =>
        console.error('[storage] Rollback delete failed for key:', storageKey, e.message)
      );
    }
    throw dbErr; // re-throw so global errorHandler handles it
  }

  // Increment company document counter
  await Company.findByIdAndUpdate(req.companyId, { $inc: { 'usage.documentsCount': 1 } });

  // Return metadata only — not the full extracted text
  const { extractedText: _omit, ...meta } = doc.toObject();
  res.status(201).json({ status: 'success', document: meta });
});

// GET /api/documents
exports.list = catchAsync(async (req, res) => {
  const documents = await Document.find({ companyId: req.companyId })
    .select('-extractedText')
    .sort('-createdAt')
    .populate('uploadedBy', 'name');

  res.json({ status: 'success', count: documents.length, documents });
});

// DELETE /api/documents/:id
exports.remove = catchAsync(async (req, res, next) => {
  const doc = await Document.findOneAndDelete({
    _id:       req.params.id,
    companyId: req.companyId,
  });
  if (!doc) return next(new AppError('Document not found', 404));

  // Delete cloud object — fire-and-forget with error logging.
  // We do NOT block the response on this: the DB record is already gone,
  // and a failed storage delete should not surface as a user-facing error.
  // Orphaned objects can be cleaned up via S3/R2 lifecycle rules.
  if (doc.storageKey) {
    deleteFromStorage(doc.storageKey).catch((err) =>
      console.error('[storage] Delete failed for key:', doc.storageKey, err.message)
    );
  }

  // Decrement company document counter (floor at 0)
  await Company.findByIdAndUpdate(req.companyId, {
    $inc: { 'usage.documentsCount': -1 },
  });
  await Company.updateOne(
    { _id: req.companyId, 'usage.documentsCount': { $lt: 0 } },
    { $set: { 'usage.documentsCount': 0 } }
  );

  res.json({ status: 'success', message: 'Document deleted' });
});

// GET /api/documents/search?q=query
exports.search = catchAsync(async (req, res, next) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2)
    return next(new AppError('Search query must be at least 2 characters', 400));

  const term = q.trim();

  let documents = [];

  try {
    // Primary: MongoDB full-text search (requires text index on Atlas)
    documents = await Document.find({
      companyId: req.companyId,
      $text:     { $search: term },
    })
      .select('originalName charCount wordCount pageCount createdAt extractedText')
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);
  } catch (textIndexErr) {
    // Fallback: regex search when text index doesn't exist yet
    // This covers fresh Atlas clusters before the index has been built.
    documents = await Document.find({
      companyId:     req.companyId,
      extractedText: { $regex: term, $options: 'i' },
    })
      .select('originalName charCount wordCount pageCount createdAt extractedText')
      .sort('-createdAt')
      .limit(20);
  }

  // Build snippets: find the first occurrence in extractedText and return ±200 chars around it
  const SNIPPET_RADIUS = 200;
  const results = documents.map(doc => {
    const idx = doc.extractedText.toLowerCase().indexOf(term.toLowerCase());
    const snippet = idx === -1 ? doc.extractedText.slice(0, SNIPPET_RADIUS) : (() => {
      const start = Math.max(0, idx - SNIPPET_RADIUS);
      const end   = Math.min(doc.extractedText.length, idx + term.length + SNIPPET_RADIUS);
      return (start > 0 ? '…' : '') + doc.extractedText.slice(start, end) + (end < doc.extractedText.length ? '…' : '');
    })();

    return {
      _id:          doc._id,
      originalName: doc.originalName,
      charCount:    doc.charCount,
      wordCount:    doc.wordCount,
      pageCount:    doc.pageCount,
      createdAt:    doc.createdAt,
      snippet,
      matchIndex:   idx,
    };
  });

  res.json({ status: 'success', count: results.length, query: term, results });
});

// GET /api/documents/:id/content
exports.getContent = catchAsync(async (req, res, next) => {
  const doc = await Document.findOne({
    _id:       req.params.id,
    companyId: req.companyId,
  }).select('originalName extractedText pageCount wordCount charCount createdAt');

  if (!doc) return next(new AppError('Document not found', 404));

  res.json({ status: 'success', document: doc });
});
