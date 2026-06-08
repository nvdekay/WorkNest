const asyncHandler = require('../../common/utils/asyncHandler');
const { ok } = require('../../common/utils/apiResponse');
const service = require('./member.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.params.workspaceId, req.query);
  return ok(res, items, meta);
});

const updateRole = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.updateRole(req.params.workspaceId, req.params.memberId, req.body.role, req.user)
  );
});

const remove = asyncHandler(async (req, res) => {
  return ok(res, await service.remove(req.params.workspaceId, req.params.memberId, req.user));
});

const leave = asyncHandler(async (req, res) => {
  return ok(res, await service.leave(req.params.workspaceId, req.user._id));
});

module.exports = { list, updateRole, remove, leave };
