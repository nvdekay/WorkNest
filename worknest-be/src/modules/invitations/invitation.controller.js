const asyncHandler = require('../../common/utils/asyncHandler');
const { ok, created } = require('../../common/utils/apiResponse');
const service = require('./invitation.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.params.workspaceId, req.query);
  return ok(res, items, meta);
});

const send = asyncHandler(async (req, res) => {
  return created(res, await service.send(req.params.workspaceId, req.body, req.user));
});

const cancel = asyncHandler(async (req, res) => {
  return ok(res, await service.cancel(req.params.workspaceId, req.params.invitationId));
});

const accept = asyncHandler(async (req, res) => {
  return ok(res, await service.accept(req.body.token, req.user));
});

const preview = asyncHandler(async (req, res) => {
  return ok(res, await service.preview(req.query.token));
});

module.exports = { list, send, cancel, accept, preview };
