const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./invitation.controller');
const v = require('./invitation.validation');

/**
 * @openapi
 * tags:
 *   - name: Invitations
 *     description: Lời mời workspace (token, accept, preview)
 *
 * components:
 *   schemas:
 *     Invitation:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         workspaceId: { type: string }
 *         email: { type: string }
 *         role: { type: string, enum: [ADMIN, MEMBER] }
 *         status: { type: string, enum: [PENDING, ACCEPTED, EXPIRED, CANCELLED] }
 *         invitedBy: { type: string }
 *         expiresAt: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

// Router lồng — mount tại /workspaces/:workspaceId/invitations.
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.use(requireAuth);
nestedRouter.use(validateObjectId('workspaceId'));

/**
 * @openapi
 * /workspaces/{workspaceId}/invitations:
 *   get:
 *     tags: [Invitations]
 *     summary: Liệt kê lời mời của workspace (token bị lược)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, ACCEPTED, EXPIRED, CANCELLED] }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: 'email contains' }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: -createdAt }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: 'array of Invitation + meta' }
 *   post:
 *     tags: [Invitations]
 *     summary: Gửi lời mời (ADMIN+)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [ADMIN, MEMBER] }
 *     responses:
 *       201: { description: Invitation }
 *       409: { description: 'ALREADY_MEMBER hoặc INVITATION_EXISTS' }
 *       422: { description: VALIDATION_ERROR }
 */
nestedRouter.get('/', requireWorkspaceRole('ADMIN'), validate(v.list), controller.list);
nestedRouter.post('/', requireWorkspaceRole('ADMIN'), validate(v.send), controller.send);

/**
 * @openapi
 * /workspaces/{workspaceId}/invitations/{invitationId}:
 *   delete:
 *     tags: [Invitations]
 *     summary: Hủy lời mời PENDING (ADMIN+)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ cancelled: true, _id }' }
 *       404: { description: NOT_FOUND }
 *       409: { description: INVITATION_NOT_PENDING }
 */
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
 * /invitations/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Chấp nhận lời mời bằng token (Auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: 64-char hex }
 *     responses:
 *       200: { description: '{ workspace: { _id, name }, role }' }
 *       403: { description: INVITATION_EMAIL_MISMATCH }
 *       410: { description: 'INVITATION_INVALID hoặc INVITATION_EXPIRED' }
 *       422: { description: VALIDATION_ERROR }
 */
flatRouter.post('/accept', requireAuth, validate(v.accept), controller.accept);

/**
 * @openapi
 * /invitations/preview:
 *   get:
 *     tags: [Invitations]
 *     summary: Xem trước lời mời (Public, không tiêu thụ token)
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string, description: 64-char hex }
 *     responses:
 *       200: { description: '{ email, role, status, expiresAt, workspace, inviter }' }
 *       410: { description: INVITATION_INVALID }
 */
flatRouter.get('/preview', validate(v.preview), controller.preview);

module.exports = { nestedRouter, flatRouter };
