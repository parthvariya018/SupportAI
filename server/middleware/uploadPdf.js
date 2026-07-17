/**
 * middleware/uploadPdf.js
 *
 * Production-grade PDF upload security middleware.
 *
 * Validation layers (in order):
 *   1. File presence          — multer rejects requests with no file field
 *   2. File size              — multer rejects files > MAX_PDF_BYTES before buffering completes
 *   3. MIME type              — multer fileFilter rejects non-PDF MIME types
 *   4. Magic bytes            — validatePdf() reads the first 5 bytes of the buffer
 *                               and rejects anything that does not start with %PDF-
 *   5. Minimum size           — rejects empty or near-empty buffers (< 5 bytes)
 *   6. Filename sanitization  — strips path separators, null bytes, and non-printable
 *                               characters; truncates to 200 chars; falls back to a
 *                               safe default when nothing printable remains
 *   7. Multer error mapping   — converts multer's own errors (LIMIT_FILE_SIZE,
 *                               LIMIT_UNEXPECTED_FILE) to clean AppError 400s so
 *                               the global errorHandler never sees a raw multer error
 *
 * Usage in routes:
 *   const { uploadMiddleware } = require('../middleware/uploadPdf');
 *   router.post('/', uploadMiddleware, upload);
 *
 * The controller reads:
 *   req.file.buffer        — unchanged (pdf-parse consumes this)
 *   req.file.sanitizedName — safe filename to store in the database
 */

const multer   = require('multer');
const AppError = require('../utils/AppError');

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_PDF_BYTES    = 10 * 1024 * 1024;  // 10 MB
const MIN_PDF_BYTES    = 5;                  // anything smaller cannot be a valid PDF
const PDF_MAGIC        = Buffer.from('%PDF-');
const MAX_FILENAME_LEN = 200;

// ── Multer instance ───────────────────────────────────────────────────────────
// fileFilter runs before the buffer is written, so MIME rejection is cheap.
// Magic-byte validation runs after buffering in validatePdf() below.
const _multer = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_PDF_BYTES },
  fileFilter(_, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      // Pass an AppError so multer surfaces it as err.message in the error handler
      return cb(new AppError('Only PDF files are allowed. Please upload a .pdf file.', 400), false);
    }
    cb(null, true);
  },
});

// ── Magic-byte validator ──────────────────────────────────────────────────────
/**
 * validatePdf — inspects the raw buffer after multer has finished writing it.
 *
 * A genuine PDF always starts with the 5-byte signature "%PDF-" (hex 25 50 44 46 2D).
 * Checking this prevents:
 *   - Renamed files (e.g. malware.exe renamed to report.pdf)
 *   - Files with a spoofed Content-Type header
 *   - Truncated / zero-byte uploads
 *
 * Returns an AppError on failure, null on success.
 */
function validatePdf(file) {
  // Req 6: reject empty or near-empty buffers
  if (!file.buffer || file.buffer.length < MIN_PDF_BYTES) {
    return new AppError('The uploaded file is empty or corrupted.', 400);
  }

  // Req 2 + 3: compare first 5 bytes against the PDF magic signature
  const header = file.buffer.slice(0, PDF_MAGIC.length);
  if (!header.equals(PDF_MAGIC)) {
    return new AppError(
      'The uploaded file is not a valid PDF. Please upload a genuine PDF file.',
      400
    );
  }

  return null; // valid
}

// ── Filename sanitizer ────────────────────────────────────────────────────────
/**
 * sanitizeFilename — produces a safe filename for database storage.
 *
 * Strips:
 *   - Path separators (/ and \) — prevents path traversal
 *   - Null bytes (\x00)         — prevents null-byte injection
 *   - Non-printable ASCII       — prevents control-character tricks
 *   - Leading dots              — prevents hidden-file names on Unix
 *
 * Truncates to MAX_FILENAME_LEN characters.
 * Falls back to 'upload.pdf' when nothing printable remains.
 */
function sanitizeFilename(original) {
  let name = String(original || '')
    // Remove path separators (path traversal prevention)
    .replace(/[/\\]/g, '_')
    // Remove null bytes
    .replace(/\x00/g, '')
    // Remove non-printable ASCII (0x00–0x1F and 0x7F)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Remove leading dots (hidden files on Unix)
  name = name.replace(/^\.+/, '');

  // Truncate
  if (name.length > MAX_FILENAME_LEN) {
    // Preserve the extension when truncating
    const ext   = name.endsWith('.pdf') ? '.pdf' : '';
    const base  = ext ? name.slice(0, MAX_FILENAME_LEN - ext.length) : name.slice(0, MAX_FILENAME_LEN);
    name = base + ext;
  }

  // Fallback when nothing printable remains
  if (!name) name = 'upload.pdf';

  return name;
}

// ── Composed middleware ───────────────────────────────────────────────────────
/**
 * uploadMiddleware — drop-in replacement for the inline multer call in routes/documents.js.
 *
 * Runs in sequence:
 *   multer.single('pdf')  →  validatePdf()  →  sanitizeFilename()
 *
 * On any validation failure, calls next(AppError) so the global errorHandler
 * returns a clean JSON 400 with no server internals exposed.
 */
function uploadMiddleware(req, res, next) {
  _multer.single('pdf')(req, res, (err) => {
    // ── Map multer's own errors to clean AppErrors ────────────────────────
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(
            `File too large. Maximum allowed size is ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
            400
          ));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError('Unexpected file field. Use the field name "pdf".', 400));
        }
        // Any other multer error
        return next(new AppError(`Upload error: ${err.message}`, 400));
      }
      // fileFilter passed an AppError (MIME rejection)
      if (err instanceof AppError) return next(err);
      // Unknown error — let the global handler deal with it
      return next(err);
    }

    // ── No file uploaded ──────────────────────────────────────────────────
    if (!req.file) {
      return next(new AppError('No PDF file uploaded. Include a file in the "pdf" field.', 400));
    }

    // ── Magic-byte validation ─────────────────────────────────────────────
    const magicErr = validatePdf(req.file);
    if (magicErr) return next(magicErr);

    // ── Filename sanitization ─────────────────────────────────────────────
    req.file.sanitizedName = sanitizeFilename(req.file.originalname);

    next();
  });
}

module.exports = { uploadMiddleware };
