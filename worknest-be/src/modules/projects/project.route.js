const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./project.controller');
const v = require('./project.validation');

const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   - name: Projects
 *     description: Project (nhóm task, key bất biến, archive)
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId'));

router.get('/', requireWorkspaceRole('MEMBER'), validate(v.list), controller.list);
router.post('/', requireWorkspaceRole('MEMBER'), validate(v.create), controller.create);

router.get('/:projectId', validateObjectId('projectId'), requireWorkspaceRole('MEMBER'), controller.getById);
router.patch('/:projectId', validateObjectId('projectId'), requireWorkspaceRole('MEMBER'), validate(v.update), controller.update);
router.post('/:projectId/archive', validateObjectId('projectId'), requireWorkspaceRole('ADMIN'), validate(v.archive), controller.archive);
router.delete('/:projectId', validateObjectId('projectId'), requireWorkspaceRole('ADMIN'), controller.remove);

module.exports = router;
