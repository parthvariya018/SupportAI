const Article   = require('../models/Article');
const AppError  = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const slugify = (text) =>
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

// GET /api/articles
exports.list = catchAsync(async (req, res) => {
  const { category, status, q } = req.query;
  const filter = { companyId: req.companyId };
  if (category) filter.category = category;
  if (status)   filter.status   = status;
  if (q)        filter.title    = { $regex: q, $options: 'i' };

  const articles = await Article.find(filter)
    .populate('author', 'name avatar')
    .select('-content')
    .sort('-updatedAt');
  res.json({ status: 'success', count: articles.length, articles });
});

// POST /api/articles
exports.create = catchAsync(async (req, res) => {
  const { title, content, category, tags, status } = req.body;
  const baseSlug = slugify(title);
  // ensure unique slug within company
  const existing = await Article.countDocuments({ companyId: req.companyId, slug: new RegExp(`^${baseSlug}`) });
  const slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;

  const article = await Article.create({
    companyId: req.companyId,
    title, content, category, tags, status,
    slug, author: req.user._id,
  });
  res.status(201).json({ status: 'success', article });
});

// GET /api/articles/:id
exports.getOne = catchAsync(async (req, res, next) => {
  const article = await Article.findOne({ _id: req.params.id, companyId: req.companyId })
    .populate('author', 'name avatar');
  if (!article) return next(new AppError('Article not found', 404));
  article.views += 1;
  await article.save({ validateModifiedOnly: true });
  res.json({ status: 'success', article });
});

// PATCH /api/articles/:id
exports.update = catchAsync(async (req, res, next) => {
  const article = await Article.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!article) return next(new AppError('Article not found', 404));
  res.json({ status: 'success', article });
});

// DELETE /api/articles/:id
exports.remove = catchAsync(async (req, res, next) => {
  const article = await Article.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!article) return next(new AppError('Article not found', 404));
  res.json({ status: 'success', message: 'Article deleted' });
});

// POST /api/articles/:id/vote
exports.vote = catchAsync(async (req, res, next) => {
  const { helpful } = req.body;
  const update = helpful ? { $inc: { helpful: 1 } } : { $inc: { notHelpful: 1 } };
  const article = await Article.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId }, update, { new: true }
  );
  if (!article) return next(new AppError('Article not found', 404));
  res.json({ status: 'success', article });
});
