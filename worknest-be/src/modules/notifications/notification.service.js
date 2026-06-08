const logger = require('../../config/logger');
const Notification = require('./notification.model');

const list = async (_userId, _query) => { throw new Error('not implemented'); };
const unreadCount = async (_userId, _workspaceId) => { throw new Error('not implemented'); };
const markRead = async (_userId, _notificationId) => { throw new Error('not implemented'); };
const markAllRead = async (_userId, _workspaceId) => { throw new Error('not implemented'); };
const remove = async (_userId, _notificationId) => { throw new Error('not implemented'); };

// Fire-and-forget: lỗi notification không bao giờ chặn caller.
// payload: { userId, workspaceId, type, title, body?, entityType, entityId, actorId? }
const emit = async (payload) => {
  try {
    await Notification.create(payload);
  } catch (err) {
    logger.error({ err, payload }, '[notification] failed to emit');
  }
};

module.exports = { list, unreadCount, markRead, markAllRead, remove, emit };
