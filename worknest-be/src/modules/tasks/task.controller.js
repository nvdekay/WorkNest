const asyncHandler = require('../../common/utils/asyncHandler');
const { ok, created } = require('../../common/utils/apiResponse');
const service = require('./task.service');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(
    req.params.workspaceId,
    req.params.projectId,
    req.query,
    req.user._id
  );
  // board → { columns: [...] }; list → { items, meta }
  if (result.columns) return ok(res, { columns: result.columns });
  return ok(res, result.items, result.meta);
});

const create = asyncHandler(async (req, res) => {
  return created(
    res,
    await service.create(req.params.workspaceId, req.params.projectId, req.body, req.user)
  );
});

const getById = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.getById(req.params.workspaceId, req.params.projectId, req.params.taskId)
  );
});

const update = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.update(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.body,
      req.user,
      req.membership
    )
  );
});

const remove = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.remove(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.user,
      req.membership
    )
  );
});

const addChecklist = asyncHandler(async (req, res) => {
  return created(
    res,
    await service.addChecklist(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.body.text,
      req.user,
      req.membership
    )
  );
});

const updateChecklist = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.updateChecklistItem(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.params.itemId,
      req.body,
      req.user,
      req.membership
    )
  );
});

const removeChecklist = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.removeChecklistItem(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.params.itemId,
      req.user,
      req.membership
    )
  );
});

const addAttachment = asyncHandler(async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return created(
    res,
    await service.addAttachment(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.file,
      req.user,
      req.membership,
      baseUrl
    )
  );
});

const removeAttachment = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.removeAttachment(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.params.attachmentId,
      req.user,
      req.membership
    )
  );
});

const watch = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.watch(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.user._id
    )
  );
});

const unwatch = asyncHandler(async (req, res) => {
  return ok(
    res,
    await service.unwatch(
      req.params.workspaceId,
      req.params.projectId,
      req.params.taskId,
      req.user._id
    )
  );
});

module.exports = {
  list, create, getById, update, remove,
  addChecklist, updateChecklist, removeChecklist,
  addAttachment, removeAttachment,
  watch, unwatch,
};
