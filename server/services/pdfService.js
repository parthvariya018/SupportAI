const pdfParse = require('pdf-parse');
const AppError  = require('../utils/AppError');

/**
 * Extracts text and metadata from a PDF buffer.
 * Wraps pdf-parse errors as operational AppErrors so the global handler
 * returns a clean 422 instead of leaking the internal stack trace.
 * @returns {{ text: string, pageCount: number, wordCount: number }}
 */
const extractFromBuffer = async (buffer) => {
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    throw new AppError(
      'Could not parse this PDF. The file may be corrupted, password-protected, or not a valid PDF.',
      422
    );
  }

  const text      = data.text.trim();
  const pageCount = data.numpages || 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return { text, pageCount, wordCount };
};

module.exports = { extractFromBuffer };
