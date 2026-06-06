const notImpl = require('../../common/utils/notImpl');

module.exports = {
  list: notImpl('GET /workspaces/:workspaceId/members'),
  updateRole: notImpl('PATCH /workspaces/:workspaceId/members/:memberId/role'),
  remove: notImpl('DELETE /workspaces/:workspaceId/members/:memberId'),
  leave: notImpl('POST /workspaces/:workspaceId/members/leave'),
};
