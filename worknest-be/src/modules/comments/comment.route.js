const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./comment.controller');
const v = require('./comment.validation');

/**
 * @openapi
 * tags:
 *   - name: Comments
 *     description: Bình luận task — phân luồng 1 cấp, @mention
 */

// Router lồng — mount tại /workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments.
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.use(requireAuth);
nestedRouter.use(validateObjectId('workspaceId', 'projectId', 'taskId'));
nestedRouter.use(requireWorkspaceRole('MEMBER'));

nestedRouter.get('/', validate(v.list), controller.list);
nestedRouter.post('/', validate(v.create), controller.create);

// Router :commentId — mount tại /workspaces/:workspaceId/comments.
const byIdRouter = express.Router({ mergeParams: true });
byIdRouter.use(requireAuth);
byIdRouter.use(validateObjectId('workspaceId', 'commentId'));
byIdRouter.use(requireWorkspaceRole('MEMBER'));

byIdRouter.patch('/:commentId', validate(v.update), controller.update);
byIdRouter.delete('/:commentId', controller.remove);

module.exports = { nestedRouter, byIdRouter };
