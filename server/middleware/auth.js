const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * protect — JWT auth middleware.
 *
 * NOT wrapped in catchAsync here because jwt.verify() throws synchronously
 * on invalid tokens. catchAsync only catches promise rejections, so a sync
 * throw inside an async function bubbles correctly — but being explicit
 * about the try/catch makes the error path unambiguous and easier to debug.
 */
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError('No token provided. Please log in.', 401));
    }

    const token   = header.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      return next(new AppError('Invalid token format. Please log in again.', 401));
    }

    // Pin algorithm to HS256 — prevents "alg: none" and RS256 confusion attacks.
    // Without this, an attacker could craft a token with alg:none and bypass verification.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('companyId')
      .lean();

    if (!user) {
      return next(new AppError('User belonging to this token no longer exists.', 401));
    }

    if (!user.companyId) {
      return next(new AppError('User has no associated company.', 401));
    }

    req.user      = user;
    req.companyId = user.companyId._id;
    next();

  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired. Please log in again.', 401));
    }
    next(err);
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

module.exports = { protect, restrictTo };
