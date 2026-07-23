const crypto     = require('crypto');
const Company    = require('../models/Company');
const User       = require('../models/User');
const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { signToken, formatUser } = require('../utils/token');
const { sendPasswordReset, sendWelcome } = require('../services/emailService');

exports.register = catchAsync(async (req, res, next) => {
  const { companyName, name, email, password } = req.body;

  if (await User.findOne({ email }))
    return next(new AppError('Email already registered', 409));

  const company = await Company.create({ name: companyName, email });

  // Free plan starts with 50 credits
  company.credits.balance        = 50;
  company.credits.totalPurchased = 50;
  company.credits.weeklyRefillAt = new Date();
  await company.save();
  const user    = await User.create({
    companyId: company._id, name, email, password,
    role: 'owner',
  });

  // Fire-and-forget — welcome email must never block the registration response
  sendWelcome(email, name, companyName);

  res.status(201).json({
    status: 'success',
    token:  signToken(user._id),
    user:   formatUser(user, company),
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password').populate('companyId');
  if (!user || !(await user.matchPassword(password)))
    return next(new AppError('Invalid email or password', 401));

  if (!user.isActive)
    return next(new AppError('Account is inactive. Please accept your invitation.', 401));

  // Update last seen
  user.lastSeenAt = new Date();
  await user.save({ validateModifiedOnly: true });

  // Weekly credit refill for free plan — only if credits were used (balance < 50)
  if (user.companyId.plan === 'free') {
    const now          = new Date();
    const lastRefill   = new Date(user.companyId.credits?.weeklyRefillAt || 0);
    const daysSince    = (now - lastRefill) / (1000 * 60 * 60 * 24);
    const balance      = user.companyId.credits?.balance ?? 0;

    if ((daysSince >= 7 || !user.companyId.credits?.weeklyRefillAt) && balance < 50) {
      await Company.findByIdAndUpdate(user.companyId._id, {
        $set: {
          'credits.balance':        50,
          'credits.weeklyRefillAt': now,
          'credits.lastTopUpAt':    now,
        },
      });
    }
  }

  res.json({
    status: 'success',
    token:  signToken(user._id),
    user:   formatUser(user, user.companyId),
  });
});

exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate('companyId');
  res.json({
    status: 'success',
    user:   formatUser(user, user.companyId),
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError('Email is required', 400));

  const user = await User.findOne({ email });
  // Always return 200 to prevent user enumeration
  if (!user) return res.json({ status: 'success', message: 'If that email exists, a reset link was sent.' });

  const token  = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  user.passwordResetToken   = hashed;
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save({ validateModifiedOnly: true });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  // Send the raw token via email — it is NEVER returned in the response body.
  // If email delivery fails we still return 200 (user enumeration prevention)
  // but we log the error so ops can investigate.
  try {
    const result = await sendPasswordReset(user.email, resetUrl);
    if (result.skipped && process.env.NODE_ENV !== 'production') {
      // SMTP not configured — log URL to console for local development only
      console.log('[AUTH] Password reset link (dev only — configure SMTP to send email):', resetUrl);
    }
  } catch (emailErr) {
    // Email failure must not expose the token or break the response.
    // The token is already saved in the DB; the user can retry the forgot-password flow.
    console.error('[AUTH] Failed to send password reset email:', emailErr.message);
  }

  res.json({ status: 'success', message: 'If that email exists, a reset link was sent.' });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token }    = req.params;
  const { password } = req.body;
  if (!password) return next(new AppError('Password is required', 400));

  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken:   hashed,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) return next(new AppError('Reset token is invalid or has expired', 400));

  user.password             = password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({
    status: 'success',
    token:  signToken(user._id),
    message: 'Password reset successful',
  });
});
