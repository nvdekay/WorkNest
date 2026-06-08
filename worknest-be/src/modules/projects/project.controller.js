const asyncHandler = require('../../common/utils/asyncHandler');
const { ok, created } = require('../../common/utils/apiResponse');
const service = require('./project.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.params.workspaceId, req.query);
  return ok(res, items, meta);
});

const create = asyncHandler(async (req, res) => {
  return created(
    res,
    await service.create(req.params.workspaceId, req.body, req.user, req.membership)
  );
});

const getById = asyncHandler(async (req, res) => {
  return ok(res, await service.getById(req.params.workspaceId, req.params.projectId));
});

const update = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.update(
      req.params.workspaceId,
      req.params.projectId,
      req.body,
      req.user,
      req.membership
    )
  );
});

const archive = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.archive(req.params.workspaceId, req.params.projectId, req.body.archived)
  );
});

const remove = asyncHandler(async (req, res) => {
  return ok(res, await service.remove(req.params.workspaceId, req.params.projectId));
});

module.exports = { list, create, getById, update, archive, remove };
