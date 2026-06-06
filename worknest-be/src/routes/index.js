const express = require('express');

const authRoute = require('../modules/auth/auth.route');
const userRoute = require('../modules/users/user.route');
const workspaceRoute = require('../modules/workspaces/workspace.route');
const memberRoute = require('../modules/members/member.route');
const { nestedRouter: nestedInvitationRoute, flatRouter: flatInvitationRoute } = require('../modules/invitations/invitation.route');
const projectRoute = require('../modules/projects/project.route');
const taskRoute = require('../modules/tasks/task.route');
const { nestedRouter: nestedCommentRoute, byIdRouter: commentByIdRoute } = require('../modules/comments/comment.route');
const notificationRoute = require('../modules/notifications/notification.route');
const activityRoute = require('../modules/activities/activity.route');
const { wsRouter: wsDashboardRoute, projectRouter: projectDashboardRoute } = require('../modules/dashboard/dashboard.route');

const router = express.Router();

// /api/auth, /api/users, /api/notifications, /api/invitations (flat)
router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/notifications', notificationRoute);
router.use('/invitations', flatInvitationRoute);

// /api/workspaces + nested
router.use('/workspaces', workspaceRoute);
router.use('/workspaces/:workspaceId/members', memberRoute);
router.use('/workspaces/:workspaceId/invitations', nestedInvitationRoute);
router.use('/workspaces/:workspaceId/projects', projectRoute);
router.use('/workspaces/:workspaceId/projects/:projectId/tasks', taskRoute);
router.use('/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments', nestedCommentRoute);
router.use('/workspaces/:workspaceId/comments', commentByIdRoute);
router.use('/workspaces/:workspaceId/activities', activityRoute);
router.use('/workspaces/:workspaceId/dashboard', wsDashboardRoute);
router.use('/workspaces/:workspaceId/projects/:projectId/dashboard', projectDashboardRoute);

module.exports = router;
