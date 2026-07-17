const router = require('express').Router();
const {
  register, login, getMe,
  forgotPassword, resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { sanitizeBody, validate, validateEmail, validatePassword } = require('../middleware/validate');

// sanitizeBody runs FIRST on every body-accepting route to block NoSQL injection
router.post('/register',
  sanitizeBody,
  validate(['companyName', 'name', 'email', 'password']),
  validateEmail,
  validatePassword('password'),
  register
);

router.post('/login',
  sanitizeBody,
  validate(['email', 'password']),
  validateEmail,
  login
);

router.post('/forgot-password', sanitizeBody, forgotPassword);
router.post('/reset-password/:token', sanitizeBody, validatePassword('password'), resetPassword);

router.get('/me', protect, getMe);

module.exports = router;
