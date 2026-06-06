const notImpl = require('../../common/utils/notImpl');

module.exports = {
  list: notImpl('GET /notifications'),
  unreadCount: notImpl('GET /notifications/unread-count'),
  markRead: notImpl('PATCH /notifications/:notificationId/read'),
  markAllRead: notImpl('PATCH /notifications/read-all'),
  remove: notImpl('DELETE /notifications/:notificationId'),
};
