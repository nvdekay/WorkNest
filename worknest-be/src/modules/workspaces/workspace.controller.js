const notImpl = require('../../common/utils/notImpl');

module.exports = {
  list: notImpl('GET /workspaces'),
  create: notImpl('POST /workspaces'),
  getById: notImpl('GET /workspaces/:workspaceId'),
  update: notImpl('PATCH /workspaces/:workspaceId'),
  remove: notImpl('DELETE /workspaces/:workspaceId'),
  transferOwnership: notImpl('POST /workspaces/:workspaceId/transfer-ownership'),
};
