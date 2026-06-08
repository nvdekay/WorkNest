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
 *
 * components:
 *   schemas:
 *     ProjectStatus:
 *       type: object
 *       properties:
 *         key: { type: string, enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE] }
 *         label: { type: string }
 *         order: { type: integer }
 *     Project:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         workspaceId: { type: string }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         key: { type: string, description: '2-6 ký tự [A-Z0-9], bất biến' }
 *         color: { type: string, nullable: true }
 *         statuses:
 *           type: array
 *           items: { $ref: '#/components/schemas/ProjectStatus' }
 *         taskCounter: { type: integer }
 *         createdBy: { type: string }
 *         archivedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId'));

/**
 * @openapi
 * /workspaces/{workspaceId}/projects:
 *   get:
 *     tags: [Projects]
 *     summary: Liệt kê project + số liệu tiến độ
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: 'name hoặc key' }
 *       - in: query
 *         name: archived
 *         schema: { type: string, enum: [true, false, all], default: false }
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
 *       200: { description: 'array of Project + taskCount/doneCount/progress + meta' }
 *   post:
 *     tags: [Projects]
 *     summary: Tạo project (ADMIN+, hoặc MEMBER nếu workspace bật memberCanCreateProject)
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
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 80 }
 *               description: { type: string, maxLength: 1000, nullable: true }
 *               key: { type: string, pattern: '^[A-Z0-9]{2,6}$', description: 'tự suy ra từ name nếu để trống' }
 *               color: { type: string, pattern: '^#[0-9A-Fa-f]{6}$' }
 *     responses:
 *       201: { description: Project }
 *       403: { description: FORBIDDEN }
 *       409: { description: PROJECT_KEY_TAKEN }
 *       422: { description: VALIDATION_ERROR }
 */
router.get('/', requireWorkspaceRole('MEMBER'), validate(v.list), controller.list);
router.post('/', requireWorkspaceRole('MEMBER'), validate(v.create), controller.create);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Chi tiết project
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project }
 *       404: { description: PROJECT_NOT_FOUND }
 *   patch:
 *     tags: [Projects]
 *     summary: Cập nhật project (ADMIN+ hoặc MEMBER là người tạo); key bất biến
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
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
 *               description: { type: string, maxLength: 1000, nullable: true }
 *               color: { type: string, pattern: '^#[0-9A-Fa-f]{6}$' }
 *               statuses:
 *                 type: array
 *                 description: 'phải đúng 4 entry với 4 key chuẩn, chỉ đổi label/order'
 *                 items: { $ref: '#/components/schemas/ProjectStatus' }
 *     responses:
 *       200: { description: Project đã cập nhật }
 *       403: { description: FORBIDDEN }
 *       409: { description: PROJECT_ARCHIVED }
 *       422: { description: VALIDATION_ERROR }
 *   delete:
 *     tags: [Projects]
 *     summary: Xóa mềm + lan tỏa task/comment (ADMIN+)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ deleted: true }' }
 *       403: { description: FORBIDDEN }
 */
router.get(
  '/:projectId',
  validateObjectId('projectId'),
  requireWorkspaceRole('MEMBER'),
  controller.getById
);
router.patch(
  '/:projectId',
  validateObjectId('projectId'),
  requireWorkspaceRole('MEMBER'),
  validate(v.update),
  controller.update
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/archive:
 *   post:
 *     tags: [Projects]
 *     summary: Bật/tắt archive (ADMIN+)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [archived]
 *             properties:
 *               archived: { type: boolean }
 *     responses:
 *       200: { description: Project }
 *       403: { description: FORBIDDEN }
 */
router.post(
  '/:projectId/archive',
  validateObjectId('projectId'),
  requireWorkspaceRole('ADMIN'),
  validate(v.archive),
  controller.archive
);

router.delete(
  '/:projectId',
  validateObjectId('projectId'),
  requireWorkspaceRole('ADMIN'),
  controller.remove
);

module.exports = router;
