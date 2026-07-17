const Company    = require('../models/Company');
const User       = require('../models/User');
const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getModel, isModelAllowed, getDefaultModel } = require('../config/modelRegistry');

// GET /api/settings
exports.getSettings = catchAsync(async (req, res) => {
  const [user, company] = await Promise.all([
    User.findById(req.user._id),
    Company.findById(req.companyId),
  ]);

  const plan           = company?.plan || 'free';
  const savedModel     = user.defaultModel;
  const effectiveModel = (savedModel && isModelAllowed(plan, savedModel))
    ? savedModel
    : getDefaultModel(plan).id;

  res.json({ status: 'success', user, company, effectiveDefaultModel: effectiveModel });
});

// PATCH /api/settings/profile
exports.updateProfile = catchAsync(async (req, res) => {
  const { name, avatar } = req.body;
  const update = {};
  if (name)   update.name   = name;
  if (avatar) update.avatar = avatar;

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
  res.json({ status: 'success', user });
});

// PATCH /api/settings/company
exports.updateCompany = catchAsync(async (req, res, next) => {
  const { name } = req.body;
  if (!name?.trim()) return next(new AppError('Company name required', 400));

  const company = await Company.findByIdAndUpdate(
    req.companyId,
    { name: name.trim() },
    { new: true, runValidators: true }
  );
  res.json({ status: 'success', company });
});

// PATCH /api/settings/password
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return next(new AppError('Both passwords required', 400));
  if (newPassword.length < 6)           return next(new AppError('Password must be at least 6 characters', 400));

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword)))
    return next(new AppError('Current password is incorrect', 401));

  user.password = newPassword;
  await user.save();

  res.json({ status: 'success', message: 'Password updated' });
});

// PATCH /api/settings/widget
exports.updateWidget = catchAsync(async (req, res, next) => {
  const { primaryColor, welcomeMessage, position, showLeadForm } = req.body;
  const company = await Company.findById(req.companyId);
  if (!company) return next(new AppError('Company not found', 404));

  if (primaryColor    !== undefined) company.widgetConfig.primaryColor    = primaryColor;
  if (welcomeMessage  !== undefined) company.widgetConfig.welcomeMessage  = welcomeMessage;
  if (position        !== undefined) company.widgetConfig.position        = position;
  if (showLeadForm    !== undefined) company.widgetConfig.showLeadForm    = showLeadForm;

  await company.save();
  res.json({ status: 'success', widgetConfig: company.widgetConfig });
});

// PATCH /api/settings/default-model
exports.updateDefaultModel = catchAsync(async (req, res, next) => {
  const { modelId } = req.body;
  if (!modelId) return next(new AppError('modelId is required', 400));

  const company = await Company.findById(req.companyId).select('plan').lean();
  const plan    = company?.plan || 'free';

  const modelConfig = getModel(modelId);
  if (!modelConfig)         return next(new AppError(`Model "${modelId}" does not exist.`, 400));
  if (!modelConfig.enabled) return next(new AppError(`Model "${modelId}" is currently disabled.`, 400));
  if (!isModelAllowed(plan, modelId))
    return next(new AppError(`Model "${modelId}" is not available on your plan.`, 403));

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { defaultModel: modelId },
    { new: true }
  );
  res.json({ status: 'success', defaultModel: user.defaultModel });
});


exports.getApiKey = catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId).select('apiKey');
  res.json({ status: 'success', apiKey: company.apiKey });
});

// POST /api/settings/api-key/rotate
exports.rotateApiKey = catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId);
  await company.regenerateApiKey();
  res.json({ status: 'success', apiKey: company.apiKey });
});
