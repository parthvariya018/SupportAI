const router = require('express').Router();
const {
  getSettings,
  updateProfile, updateCompany, updatePassword,
  updateWidget, getApiKey, rotateApiKey,
  updateDefaultModel,
} = require('../controllers/settingsController');
const { protect, restrictTo } = require('../middleware/auth');
const { requirePermission }   = require('../middleware/rbac');
const { requirePlan }         = require('../middleware/planGuard');

router.use(protect);

router.get('/',                    requirePermission('settings:read'),  getSettings);
router.patch('/profile',           requirePermission('settings:write'), updateProfile);
router.patch('/company',           requirePermission('settings:write'), restrictTo('owner', 'admin'), updateCompany);
router.patch('/password',          updatePassword);
router.patch('/default-model',     requirePermission('settings:write'), updateDefaultModel);
router.patch('/widget',            requirePermission('settings:write'), restrictTo('owner', 'admin'), updateWidget);

// API key access: Pro+
router.get('/api-key',             requirePlan('pro'), requirePermission('apikey:rotate'), getApiKey);
router.post('/api-key/rotate',     requirePlan('pro'), requirePermission('apikey:rotate'), rotateApiKey);

module.exports = router;
