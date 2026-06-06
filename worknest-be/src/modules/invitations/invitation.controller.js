const notImpl = require('../../common/utils/notImpl');

module.exports = {
  list: notImpl('GET /workspaces/:workspaceId/invitations'),
  send: notImpl('POST /workspaces/:workspaceId/invitations'),
  cancel: notImpl('DELETE /workspaces/:workspaceId/invitations/:invitationId'),
  accept: notImpl('POST /invitations/accept'),
  preview: notImpl('GET /invitations/preview'),
};
