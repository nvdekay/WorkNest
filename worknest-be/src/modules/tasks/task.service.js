// TODO: taskCode atomic counter, position sparse float + rebalance, status transition hook,
// assignee ACTIVE-only, completedAt set/clear, side-effects activity + notification.

const list = async (_workspaceId, _projectId, _query) => { throw new Error('not implemented'); };
const create = async (_workspaceId, _projectId, _payload, _actor) => { throw new Error('not implemented'); };
const getById = async (_workspaceId, _projectId, _taskId) => { throw new Error('not implemented'); };
const update = async (_workspaceId, _projectId, _taskId, _payload, _actor) => { throw new Error('not implemented'); };
const remove = async (_workspaceId, _projectId, _taskId, _actor) => { throw new Error('not implemented'); };

const addChecklist = async (_taskId, _payload, _actor) => { throw new Error('not implemented'); };
const updateChecklist = async (_taskId, _itemId, _payload, _actor) => { throw new Error('not implemented'); };
const removeChecklist = async (_taskId, _itemId, _actor) => { throw new Error('not implemented'); };

const addAttachment = async (_taskId, _file, _actor) => { throw new Error('not implemented'); };
const removeAttachment = async (_taskId, _attachmentId, _actor) => { throw new Error('not implemented'); };

const watch = async (_taskId, _userId) => { throw new Error('not implemented'); };
const unwatch = async (_taskId, _userId) => { throw new Error('not implemented'); };

module.exports = {
  list, create, getById, update, remove,
  addChecklist, updateChecklist, removeChecklist,
  addAttachment, removeAttachment,
  watch, unwatch,
};
