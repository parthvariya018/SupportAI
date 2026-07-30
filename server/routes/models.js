const express    = require('express');
const { protect } = require('../middleware/auth');
const { MODELS, planMeetsRequirement } = require('../config/modelRegistry');
const Company    = require('../models/Company');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

router.get('/', protect, catchAsync(async (req, res) => {
  const company = await Company.findById(req.companyId).select('plan').lean();
  const plan    = company?.plan || 'free';

  const models = Object.entries(MODELS)
    .filter(([, m]) => m.enabled && planMeetsRequirement(plan, m.minimumPlan))
    .map(([id, m]) => ({
      id,
      displayName:  m.displayName,
      provider:     m.provider,
      streaming:    m.streaming,
    }));

  res.json({
    status:       'success',
    defaultModel: models[0]?.id || null,
    models,
  });
}));

module.exports = router;
