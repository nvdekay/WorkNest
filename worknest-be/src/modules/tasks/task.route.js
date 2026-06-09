const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const { attachmentUpload } = require('../../common/middlewares/upload');
const controller = require('./task.controller');
const v = require('./task.validation');

const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   - name: Tasks
 *     description: Task — board/list, checklist, attachments, watch
 *
 * components:
 *   schemas:
 *     Label:
 *       type: object
 *       properties:
 *         name: { type: string, minLength: 1, maxLength: 20 }
 *         color: { type: string, pattern: '^#[0-9A-Fa-f]{6}$' }
 *     ChecklistItem:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         text: { type: string }
 *         done: { type: boolean }
 *         order: { type: integer }
 *     Attachment:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         fileName: { type: string }
 *         fileUrl: { type: string }
 *         fileSize: { type: integer }
 *         mimeType: { type: string }
 *         uploadedBy: { type: string }
 *         uploadedAt: { type: string, format: date-time }
 *     Task:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         workspaceId: { type: string }
 *         projectId: { type: string }
 *         taskCode: { type: string, description: '<projectKey>-<n>' }
 *         title: { type: string }
 *         description: { type: string, nullable: true }
 *         status: { type: string, enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE] }
 *         priority: { type: string, enum: [LOW, MEDIUM, HIGH, URGENT] }
 *         position: { type: number }
 *         assignee: { type: string, nullable: true }
 *         createdBy: { type: string }
 *         dueDate: { type: string, format: date-time, nullable: true }
 *         startDate: { type: string, format: date-time, nullable: true }
 *         completedAt: { type: string, format: date-time, nullable: true }
 *         isOverdue: { type: boolean, description: 'virtual = dueDate < now && status != DONE' }
 *         labels: { type: array, items: { $ref: '#/components/schemas/Label' } }
 *         checklist: { type: array, items: { $ref: '#/components/schemas/ChecklistItem' } }
 *         attachments: { type: array, items: { $ref: '#/components/schemas/Attachment' } }
 *         watchers: { type: array, items: { type: string } }
 *         commentCount: { type: integer }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId', 'projectId'));
router.use(requireWorkspaceRole('MEMBER'));

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Liệt kê task — board (cột) hoặc list (phẳng)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: view
 *         schema: { type: string, enum: [board, list], default: board }
 *       - in: query
 *         name: status
 *         schema: { type: string, description: 'CSV vd TODO,DONE' }
 *       - in: query
 *         name: assignee
 *         schema: { type: string, description: 'ObjectId | me | none' }
 *       - in: query
 *         name: priority
 *         schema: { type: string, description: 'CSV' }
 *       - in: query
 *         name: label
 *         schema: { type: string, description: 'CSV label names' }
 *       - in: query
 *         name: dueFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dueTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: overdue
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: 'title hoặc taskCode' }
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
 *       200:
 *         description: 'view=board → { columns: [{status,label,tasks,total}] }; view=list → array + meta'
 *   post:
 *     tags: [Tasks]
 *     summary: Tạo task
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
 *             required: [title]
 *             properties:
 *               title: { type: string, minLength: 1, maxLength: 200 }
 *               description: { type: string, maxLength: 10000, nullable: true }
 *               status: { type: string, enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE] }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH, URGENT] }
 *               assigneeId: { type: string, nullable: true }
 *               dueDate: { type: string, format: date-time, nullable: true }
 *               startDate: { type: string, format: date-time, nullable: true }
 *               labels:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/Label' }
 *     responses:
 *       201: { description: Task }
 *       409: { description: 'PROJECT_ARCHIVED hoặc INVALID_STATUS_TRANSITION' }
 *       422: { description: 'VALIDATION_ERROR hoặc ASSIGNEE_NOT_MEMBER' }
 */
router.get('/', validate(v.list), controller.list);
router.post('/', validate(v.create), controller.create);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Chi tiết task (populate assignee/createdBy/watchers)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Task }
 *       404: { description: TASK_NOT_FOUND }
 *   patch:
 *     tags: [Tasks]
 *     summary: Cập nhật một phần (Member chỉ khi là createdBy/assignee)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string, nullable: true }
 *               status: { type: string, enum: [TODO, IN_PROGRESS, IN_REVIEW, DONE] }
 *               position: { type: number }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH, URGENT] }
 *               assigneeId: { type: string, nullable: true }
 *               dueDate: { type: string, format: date-time, nullable: true }
 *               startDate: { type: string, format: date-time, nullable: true }
 *               labels:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/Label' }
 *     responses:
 *       200: { description: Task }
 *       403: { description: FORBIDDEN }
 *       409: { description: 'INVALID_STATUS_TRANSITION hoặc PROJECT_ARCHIVED' }
 *       422: { description: 'VALIDATION_ERROR hoặc ASSIGNEE_NOT_MEMBER' }
 *   delete:
 *     tags: [Tasks]
 *     summary: Xóa mềm task + cascade comment (Member chỉ task mình tạo)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ deleted: true }' }
 *       403: { description: FORBIDDEN }
 */
router.get('/:taskId', validateObjectId('taskId'), controller.getById);
router.patch('/:taskId', validateObjectId('taskId'), validate(v.update), controller.update);
router.delete('/:taskId', validateObjectId('taskId'), controller.remove);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/checklist:
 *   post:
 *     tags: [Tasks]
 *     summary: Thêm mục checklist (≤ 50)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, minLength: 1, maxLength: 200 }
 *     responses:
 *       201: { description: ChecklistItem }
 *       422: { description: CHECKLIST_LIMIT }
 */
router.post(
  '/:taskId/checklist',
  validateObjectId('taskId'),
  validate(v.checklistCreate),
  controller.addChecklist
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/checklist/{itemId}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Sửa mục checklist
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string, minLength: 1, maxLength: 200 }
 *               done: { type: boolean }
 *               order: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: ChecklistItem }
 *       404: { description: NOT_FOUND }
 *   delete:
 *     tags: [Tasks]
 *     summary: Xóa mục checklist
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ removed: true, itemId }' }
 */
router.patch(
  '/:taskId/checklist/:itemId',
  validateObjectId('taskId', 'itemId'),
  validate(v.checklistUpdate),
  controller.updateChecklist
);
router.delete(
  '/:taskId/checklist/:itemId',
  validateObjectId('taskId', 'itemId'),
  controller.removeChecklist
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/attachments:
 *   post:
 *     tags: [Tasks]
 *     summary: Upload tệp đính kèm (multipart/form-data, field=file, ≤ 10 MB)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Attachment }
 *       422: { description: INVALID_FILE }
 */
router.post(
  '/:taskId/attachments',
  validateObjectId('taskId'),
  attachmentUpload,
  controller.addAttachment
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/attachments/{attachmentId}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Xóa attachment (chỉ người upload hoặc ADMIN+)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ removed: true, attachmentId }' }
 *       403: { description: FORBIDDEN }
 *       404: { description: NOT_FOUND }
 */
router.delete(
  '/:taskId/attachments/:attachmentId',
  validateObjectId('taskId', 'attachmentId'),
  controller.removeAttachment
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/watch:
 *   post:
 *     tags: [Tasks]
 *     summary: Tự thêm vào watchers
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ watching: true }' }
 *   delete:
 *     tags: [Tasks]
 *     summary: Tự bỏ khỏi watchers
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: '{ watching: false }' }
 */
router.post('/:taskId/watch', validateObjectId('taskId'), controller.watch);
router.delete('/:taskId/watch', validateObjectId('taskId'), controller.unwatch);

module.exports = router;
