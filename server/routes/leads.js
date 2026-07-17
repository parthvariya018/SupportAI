const router = require('express').Router();
const { create, list }    = require('../controllers/leadController');
const { protect }         = require('../middleware/auth');
const { resolveByApiKey } = require('../middleware/apiKey');
const { sanitizeBody, validate, validateEmail } = require('../middleware/validate');

// Public — submitted from the chat widget
router.post('/',
  resolveByApiKey,
  sanitizeBody,
  validate(['name', 'email']),
  validateEmail,
  create
);

// Authenticated
router.get('/', protect, list);

module.exports = router;
