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
 *
 * components:
 *   schemas:
 *     Workspace:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         avatarUrl: { type: string, nullable: true }
 *         ownerId: { type: string }
 *         settings:
 *           type: object
 *           properties:
 *             memberCanCreateProject: { type: boolean }
 *             timezone: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         myRole: { type: string, enum: [OWNER, ADMIN, MEMBER] }
 */

router.use(requireAuth);

/**
 * @openapi
 * /workspaces:
 *   get:
 *     tags: [Workspaces]
 *     summary: Liệt kê workspace mình là ACTIVE member
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
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
 *       200: { description: 'mảng { ...workspace, myRole, memberCount, projectCount } + meta phân trang' }
 *   post:
 *     tags: [Workspaces]
 *     summary: Tạo workspace mới (mình tự thành OWNER)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 80 }
 *               description: { type: string, maxLength: 500, nullable: true }
 *     responses:
 *       201: { description: Workspace }
 *       403: { description: WORKSPACE_LIMIT_REACHED }
 *       422: { description: VALIDATION_ERROR }
 */
router.get('/', validate(v.list), controller.list);
router.post('/', validate(v.create), controller.create);

/**
 * @openapi
 * /workspaces/{workspaceId}:
 *   get:
 *     tags: [Workspaces]
 *     summary: Chi tiết + myRole
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workspace }
 *       404: { description: WORKSPACE_NOT_FOUND (cũng cho non-member để chống IDOR) }
 *   patch:
 *     tags: [Workspaces]
 *     summary: Cập nhật (ADMIN+)
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
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 80 }
 *               description: { type: string, maxLength: 500, nullable: true }
 *               avatarUrl: { type: string, format: uri, nullable: true, description: chỉ https }
 *               settings:
 *                 type: object
 *                 properties:
 *                   memberCanCreateProject: { type: boolean }
 *                   timezone: { type: string, description: IANA tz, vd Asia/Ho_Chi_Minh }
 *     responses:
 *       200: { description: Workspace đã cập nhật }
 *       403: { description: FORBIDDEN }
 *       422: { description: VALIDATION_ERROR }
 *   delete:
 *     tags: [Workspaces]
 *     summary: Xóa mềm + lan tỏa (OWNER)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ deleted: true }' }
 *       403: { description: FORBIDDEN }
 */
router.get(
  '/:workspaceId',
  validateObjectId('workspaceId'),
  requireWorkspaceRole('MEMBER'),
  controller.getById
);
router.patch(
  '/:workspaceId',
  validateObjectId('workspaceId'),
  requireWorkspaceRole('ADMIN'),
  validate(v.update),
  controller.update
);
router.delete(
  '/:workspaceId',
  validateObjectId('workspaceId'),
  requireWorkspaceRole('OWNER'),
  controller.remove
);

/**
 * @openapi
 * /workspaces/{workspaceId}/transfer-ownership:
 *   post:
 *     tags: [Workspaces]
 *     summary: Chuyển giao quyền sở hữu sang một ACTIVE member khác (OWNER)
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
 *             required: [newOwnerId]
 *             properties:
 *               newOwnerId: { type: string }
 *     responses:
 *       200: { description: '{ transferred: true, ownerId }' }
 *       403: { description: FORBIDDEN }
 *       422: { description: 'USER_NOT_MEMBER hoặc VALIDATION_ERROR (cannot transfer to yourself)' }
 */
router.post(
  '/:workspaceId/transfer-ownership',
  validateObjectId('workspaceId'),
  requireWorkspaceRole('OWNER'),
  validate(v.transferOwnership),
  controller.transferOwnership
);

module.exports = router;
