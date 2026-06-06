const notImpl = require('../../common/utils/notImpl');

const prefix = '/workspaces/:workspaceId/projects/:projectId/tasks';

module.exports = {
  list: notImpl(`GET ${prefix}`),
  create: notImpl(`POST ${prefix}`),
  getById: notImpl(`GET ${prefix}/:taskId`),
  update: notImpl(`PATCH ${prefix}/:taskId`),
  remove: notImpl(`DELETE ${prefix}/:taskId`),

  addChecklist: notImpl(`POST ${prefix}/:taskId/checklist`),
  updateChecklist: notImpl(`PATCH ${prefix}/:taskId/checklist/:itemId`),
  removeChecklist: notImpl(`DELETE ${prefix}/:taskId/checklist/:itemId`),

  addAttachment: notImpl(`POST ${prefix}/:taskId/attachments`),
  removeAttachment: notImpl(`DELETE ${prefix}/:taskId/attachments/:attachmentId`),

  watch: notImpl(`POST ${prefix}/:taskId/watch`),
  unwatch: notImpl(`DELETE ${prefix}/:taskId/watch`),
};
