const express  = require('express');
const { protect } = require('../middleware/auth');
const { getModelsForPlan, getDefaultModel } = require('../config/modelRegistry');
const Company  = require('../models/Company');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.get('/', protect, catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId).select('plan').lean();
  const plan    = company?.plan || 'free';
  const models  = getModelsForPlan(plan);
  const def     = getDefaultModel(plan);

  res.json({
    status:       'success',
    defaultModel: def.id,
    models:       models.map(({ id, displayName, provider, supportsStreaming }) => ({ id, displayName, provider, supportsStreaming })),
  });
}));

module.exports = router;
