const notImpl = require('../../common/utils/notImpl');

module.exports = {
  workspaceOverview: notImpl('GET /workspaces/:workspaceId/dashboard'),
  projectOverview: notImpl('GET /workspaces/:workspaceId/projects/:projectId/dashboard'),
  myWork: notImpl('GET /workspaces/:workspaceId/dashboard/my-work'),
};
