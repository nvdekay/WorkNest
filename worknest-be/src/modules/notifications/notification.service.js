// Service dùng chung — các module khác gọi emit() để bắn notification.
// TODO: khử trùng lặp (userId, type, entityId) trong khoảng ngắn; ưu tiên độ cụ thể.

const list = async (_userId, _query) => { throw new Error('not implemented'); };
const unreadCount = async (_userId, _workspaceId) => { throw new Error('not implemented'); };
const markRead = async (_userId, _notificationId) => { throw new Error('not implemented'); };
const markAllRead = async (_userId, _workspaceId) => { throw new Error('not implemented'); };
const remove = async (_userId, _notificationId) => { throw new Error('not implemented'); };

// Dùng chung — không throw để fire-and-forget.
const emit = async (_payload) => {
  // TODO: tạo notification document, fire-and-forget; log lỗi không chặn caller.
};

module.exports = { list, unreadCount, markRead, markAllRead, remove, emit };
