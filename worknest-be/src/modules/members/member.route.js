const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./member.controller');
const v = require('./member.validation');

// Mount tại /workspaces/:workspaceId/members trong routes/index.js.
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   - name: Members
 *     description: Thành viên workspace (RBAC, leave/remove/role)
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId'));

router.get('/', requireWorkspaceRole('MEMBER'), validate(v.list), controller.list);
router.post('/leave', requireWorkspaceRole('MEMBER'), controller.leave);

router.patch(
  '/:memberId/role',
  validateObjectId('memberId'),
  requireWorkspaceRole('OWNER'),
  validate(v.updateRole),
  controller.updateRole
);
router.delete(
  '/:memberId',
  validateObjectId('memberId'),
  requireWorkspaceRole('ADMIN'),
  controller.remove
);

module.exports = router;
