const asyncHandler = require('../../common/utils/asyncHandler');
const { ok, created } = require('../../common/utils/apiResponse');
const service = require('./workspace.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.user._id, req.query);
  return ok(res, items, meta);
});

const create = asyncHandler(async (req, res) => {
  return created(res, await service.create(req.user._id, req.body));
});

const getById = asyncHandler(async (req, res) => {
  return ok(res, await service.getById(req.params.workspaceId, req.membership));
});

const update = asyncHandler(async (req, res) => {
  return ok(res, await service.update(req.params.workspaceId, req.body));
});

const remove = asyncHandler(async (req, res) => {
  return ok(res, await service.remove(req.params.workspaceId));
});

const transferOwnership = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.transferOwnership(req.params.workspaceId, req.body.newOwnerId, req.user._id)
  );
});

module.exports = { list, create, getById, update, remove, transferOwnership };
