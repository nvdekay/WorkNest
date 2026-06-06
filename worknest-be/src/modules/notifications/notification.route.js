const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const validateObjectId = require('../../common/middlewares/validateObjectId');
const controller = require('./notification.controller');
const v = require('./notification.validation');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Notifications
 *     description: Thông báo cá nhân, polling unread-count
 */

router.use(requireAuth);

router.get('/', validate(v.list), controller.list);
router.get('/unread-count', validate(v.unreadCount), controller.unreadCount);
router.patch('/read-all', validate(v.readAll), controller.markAllRead);

router.patch('/:notificationId/read', validateObjectId('notificationId'), controller.markRead);
router.delete('/:notificationId', validateObjectId('notificationId'), controller.remove);

module.exports = router;
