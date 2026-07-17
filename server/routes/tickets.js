const router = require('express').Router();
const { list, create, getOne, update, remove, addNote } = require('../controllers/ticketController');
const { protect }           = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { validate }          = require('../middleware/validate');

router.use(protect);

router.route('/')
  .get(requirePermission('tickets:read'),  list)
  .post(requirePermission('tickets:write'), validate(['title', 'description']), create);

router.route('/:id')
  .get(requirePermission('tickets:read'),   getOne)
  .patch(requirePermission('tickets:write'), update)
  .delete(requirePermission('tickets:delete'), remove);

router.post('/:id/notes', requirePermission('tickets:write'), validate(['content']), addNote);

module.exports = router;
