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
 *
 * components:
 *   schemas:
 *     Member:
 *       type: object
 *       properties:
 *         membershipId: { type: string }
 *         user:
 *           type: object
 *           properties:
 *             _id: { type: string }
 *             name: { type: string }
 *             email: { type: string }
 *             avatarUrl: { type: string, nullable: true }
 *         role: { type: string, enum: [OWNER, ADMIN, MEMBER] }
 *         status: { type: string, enum: [ACTIVE, REMOVED] }
 *         joinedAt: { type: string, format: date-time }
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId'));

/**
 * @openapi
 * /workspaces/{workspaceId}/members:
 *   get:
 *     tags: [Members]
 *     summary: Liệt kê thành viên workspace
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: 'name/email contains (case-insensitive)' }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [OWNER, ADMIN, MEMBER] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, REMOVED] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: -joinedAt }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: 'array of Member + pagination meta' }
 */
router.get('/', requireWorkspaceRole('MEMBER'), validate(v.list), controller.list);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/leave:
 *   post:
 *     tags: [Members]
 *     summary: Tự rời workspace (OWNER không được rời)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ left: true }' }
 *       409: { description: OWNER_CANNOT_LEAVE }
 */
router.post('/leave', requireWorkspaceRole('MEMBER'), controller.leave);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{memberId}/role:
 *   patch:
 *     tags: [Members]
 *     summary: Đổi vai trò thành viên (OWNER)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [ADMIN, MEMBER] }
 *     responses:
 *       200: { description: '{ membershipId, role }' }
 *       403: { description: 'FORBIDDEN (self-target hoặc caller không phải OWNER)' }
 *       409: { description: CANNOT_MODIFY_OWNER }
 *       422: { description: VALIDATION_ERROR }
 */
router.patch(
  '/:memberId/role',
  validateObjectId('memberId'),
  requireWorkspaceRole('OWNER'),
  validate(v.updateRole),
  controller.updateRole
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{memberId}:
 *   delete:
 *     tags: [Members]
 *     summary: Xóa thành viên (status REMOVED) + unassign mọi task của họ
 *     description: ADMIN chỉ xóa được MEMBER; OWNER xóa được cả ADMIN + MEMBER; không ai xóa được OWNER.
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ removed: true, membershipId }' }
 *       403: { description: FORBIDDEN }
 *       409: { description: CANNOT_REMOVE_OWNER }
 */
router.delete(
  '/:memberId',
  validateObjectId('memberId'),
  requireWorkspaceRole('ADMIN'),
  controller.remove
);

module.exports = router;
