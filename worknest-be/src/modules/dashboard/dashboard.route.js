const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./dashboard.controller');
const v = require('./dashboard.validation');

/**
 * @openapi
 * tags:
 *   - name: Dashboard
 *     description: Tổng quan workspace / project / my-work (read-only)
 */

// Workspace-level dashboard — mount tại /workspaces/:workspaceId/dashboard.
const wsRouter = express.Router({ mergeParams: true });
wsRouter.use(requireAuth);
wsRouter.use(validateObjectId('workspaceId'));
wsRouter.use(requireWorkspaceRole('MEMBER'));

wsRouter.get('/', validate(v.range), controller.workspaceOverview);
wsRouter.get('/my-work', controller.myWork);

// Project-level dashboard — mount tại /workspaces/:workspaceId/projects/:projectId/dashboard.
const projectRouter = express.Router({ mergeParams: true });
projectRouter.use(requireAuth);
projectRouter.use(validateObjectId('workspaceId', 'projectId'));
projectRouter.use(requireWorkspaceRole('MEMBER'));

projectRouter.get('/', validate(v.range), controller.projectOverview);

module.exports = { wsRouter, projectRouter };
