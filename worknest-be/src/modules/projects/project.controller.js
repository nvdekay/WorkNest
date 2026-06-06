const notImpl = require('../../common/utils/notImpl');

module.exports = {
  list: notImpl('GET /workspaces/:workspaceId/projects'),
  create: notImpl('POST /workspaces/:workspaceId/projects'),
  getById: notImpl('GET /workspaces/:workspaceId/projects/:projectId'),
  update: notImpl('PATCH /workspaces/:workspaceId/projects/:projectId'),
  archive: notImpl('POST /workspaces/:workspaceId/projects/:projectId/archive'),
  remove: notImpl('DELETE /workspaces/:workspaceId/projects/:projectId'),
};
