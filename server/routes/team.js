const router = require('express').Router();
const {
  listMembers, invite, acceptInvite, updateRole, removeMember,
  listGroups, createGroup, updateGroup, deleteGroup,
} = require('../controllers/teamController');
const { protect, restrictTo } = require('../middleware/auth');
const { requirePermission }   = require('../middleware/rbac');

// Public — no JWT needed (invited user has no token yet)
router.post('/invite/accept/:token', acceptInvite);

router.use(protect);

// Members
router.get('/',                           requirePermission('team:read'),   listMembers);
router.post('/invite',                    requirePermission('team:write'),  invite);
router.patch('/:id/role',                 requirePermission('team:write'),  updateRole);
router.delete('/:id',                     requirePermission('team:delete'), removeMember);

// Groups (Teams)
router.get('/groups',                     requirePermission('team:read'),   listGroups);
router.post('/groups',                    requirePermission('team:write'),  createGroup);
router.patch('/groups/:id',               requirePermission('team:write'),  updateGroup);
router.delete('/groups/:id',              requirePermission('team:delete'), deleteGroup);

module.exports = router;
