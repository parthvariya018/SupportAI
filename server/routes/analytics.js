const router = require('express').Router();
const {
  getOverview, getConversationStats, getTicketStats,
  getVolumeStats, getAgentStats, getCSAT, getLeadStats,
} = require('../controllers/analyticsController');
const { protect }           = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(protect);
router.use(requirePermission('analytics:read'));

router.get('/overview',       getOverview);
router.get('/conversations',  getConversationStats);
router.get('/tickets',        getTicketStats);
router.get('/volume',         getVolumeStats);
router.get('/agents',         getAgentStats);
router.get('/csat',           getCSAT);
router.get('/leads',          getLeadStats);

module.exports = router;
