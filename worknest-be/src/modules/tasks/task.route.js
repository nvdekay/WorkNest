const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const requireWorkspaceRole = require('../../common/middlewares/requireWorkspaceRole');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./task.controller');
const v = require('./task.validation');

const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   - name: Tasks
 *     description: Task — board/list, checklist, attachments, watch
 */

router.use(requireAuth);
router.use(validateObjectId('workspaceId', 'projectId'));
router.use(requireWorkspaceRole('MEMBER'));

router.get('/', validate(v.list), controller.list);
router.post('/', validate(v.create), controller.create);

router.get('/:taskId', validateObjectId('taskId'), controller.getById);
router.patch('/:taskId', validateObjectId('taskId'), validate(v.update), controller.update);
router.delete('/:taskId', validateObjectId('taskId'), controller.remove);

// Checklist
router.post('/:taskId/checklist', validateObjectId('taskId'), validate(v.checklistCreate), controller.addChecklist);
router.patch(
  '/:taskId/checklist/:itemId',
  validateObjectId('taskId', 'itemId'),
  validate(v.checklistUpdate),
  controller.updateChecklist
);
router.delete('/:taskId/checklist/:itemId', validateObjectId('taskId', 'itemId'), controller.removeChecklist);

// Attachments (multipart sẽ wire multer khi implement)
router.post('/:taskId/attachments', validateObjectId('taskId'), controller.addAttachment);
router.delete(
  '/:taskId/attachments/:attachmentId',
  validateObjectId('taskId', 'attachmentId'),
  controller.removeAttachment
);

// Watch / Unwatch
router.post('/:taskId/watch', validateObjectId('taskId'), controller.watch);
router.delete('/:taskId/watch', validateObjectId('taskId'), controller.unwatch);

module.exports = router;
