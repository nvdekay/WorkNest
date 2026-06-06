const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./invitation.controller');
const v = require('./invitation.validation');

// Router lồng — mount tại /workspaces/:workspaceId/invitations.
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.use(requireAuth);
nestedRouter.use(validateObjectId('workspaceId'));

nestedRouter.get('/', requireWorkspaceRole('ADMIN'), controller.list);
nestedRouter.post('/', requireWorkspaceRole('ADMIN'), validate(v.send), controller.send);
nestedRouter.delete(
  '/:invitationId',
  validateObjectId('invitationId'),
  requireWorkspaceRole('ADMIN'),
  controller.cancel
);

// Router phẳng — mount tại /invitations (accept cần auth, preview public).
const flatRouter = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Invitations
 *     description: Lời mời workspace (token, accept, preview)
 */

flatRouter.post('/accept', requireAuth, validate(v.accept), controller.accept);
flatRouter.get('/preview', validate(v.preview), controller.preview);

module.exports = { nestedRouter, flatRouter };
