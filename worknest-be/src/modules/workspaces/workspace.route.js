const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./workspace.controller');
const v = require('./workspace.validation');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Workspaces
 *     description: CRUD workspace, ranh giới tenant, chuyển giao quyền sở hữu
 */

router.use(requireAuth);

router.get('/', validate(v.list), controller.list);
router.post('/', validate(v.create), controller.create);

router.get('/:workspaceId', validateObjectId('workspaceId'), requireWorkspaceRole('MEMBER'), controller.getById);
router.patch('/:workspaceId', validateObjectId('workspaceId'), requireWorkspaceRole('ADMIN'), validate(v.update), controller.update);
router.delete('/:workspaceId', validateObjectId('workspaceId'), requireWorkspaceRole('OWNER'), controller.remove);
router.post(
  '/:workspaceId/transfer-ownership',
  validateObjectId('workspaceId'),
  requireWorkspaceRole('OWNER'),
  validate(v.transferOwnership),
  controller.transferOwnership
);

module.exports = router;
