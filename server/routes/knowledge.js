const router = require('express').Router();
const { list, create, getOne, update, remove, vote } = require('../controllers/knowledgeController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(list).post(validate(['title', 'content']), create);
router.route('/:id').get(getOne).patch(update).delete(remove);
router.post('/:id/vote', vote);

function validate(fields) {
  const AppError = require('../utils/AppError');
  return (req, res, next) => {
    const missing = fields.filter(f => !req.body[f]?.toString().trim());
    if (missing.length) return next(new AppError(`Missing: ${missing.join(', ')}`, 400));
    next();
  };
}

module.exports = router;
