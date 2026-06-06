const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./activity.controller');
const v = require('./activity.validation');

const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   - name: Activities
 *     description: Activity log (audit append-only)
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId'));
router.use(requireWorkspaceRole('MEMBER'));

router.get('/', validate(v.list), controller.list);

module.exports = router;
