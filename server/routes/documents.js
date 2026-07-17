const router   = require('express').Router();
const { upload, list, remove, search, getContent } = require('../controllers/documentController');
const { protect }        = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/uploadPdf');

router.use(protect);

/**
 * IMPORTANT: Static string routes MUST come before parameterised routes.
 * If '/:id' were registered before '/search', Express would match
 * GET /documents/search with id = "search" — returning 404 from findById.
 *
 * Correct order:
 *   1. GET  /search       ← static, must be first
 *   2. GET  /             ← no param conflict
 *   3. POST /             ← no param conflict
 *   4. GET  /:id/content  ← param, after all statics
 *   5. DELETE /:id        ← param, after all statics
 */
router.get('/search',      search);
router.get('/',            list);
router.post('/',           uploadMiddleware, upload);
router.get('/:id/content', getContent);
router.delete('/:id',      remove);

module.exports = router;
