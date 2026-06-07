const mongoose = require('mongoose');

const ApiError = require('../../common/errors/ApiError');
const {
  ROLE,
  MEMBER_STATUS,
  INVITATION_STATUS,
  LIMITS,
} = require('../../common/constants');
const { parsePagination, buildMeta, parseSort } = require('../../common/utils/pagination');

const Workspace = require('./workspace.model');
const WorkspaceMember = require('./workspaceMember.model');
const Invitation = require('./invitation.model');
const Project = require('../projects/project.model');
const Task = require('../tasks/task.model');
const Comment = require('../comments/comment.model');
const activityService = require('../activities/activity.service');

const SORTABLE = ['name', 'createdAt', 'updatedAt'];

const sanitize = (ws) => ({
  _id: ws._id,
  name: ws.name,
  description: ws.description,
  avatarUrl: ws.avatarUrl,
  ownerId: ws.ownerId,
  settings: ws.settings,
  createdAt: ws.createdAt,
  updatedAt: ws.updatedAt,
});

// GET /workspaces — workspace mà user là ACTIVE member; loại workspace đã xóa mềm.
const list = async (userId, query = {}) => {
  const { page, limit } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE);
  const sortKey = Object.keys(sort)[0] || 'createdAt';
  const sortDir = sort[sortKey] || -1;

  const memberships = await WorkspaceMember.find({ userId, status: MEMBER_STATUS.ACTIVE })
    .populate({ path: 'workspaceId', match: { deletedAt: null } });

  // Lọc populate trả null (workspace đã xóa mềm) + search theo tên.
  let active = memberships.filter((m) => m.workspaceId);
  if (query.search) {
    const needle = query.search.toLowerCase();
    active = active.filter((m) => m.workspaceId.name.toLowerCase().includes(needle));
  }

  active.sort((a, b) => {
    const av = a.workspaceId[sortKey];
    const bv = b.workspaceId[sortKey];
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  const total = active.length;
  const slice = active.slice((page - 1) * limit, (page - 1) * limit + limit);

  const items = await Promise.all(
    slice.map(async (m) => {
      const [memberCount, projectCount] = await Promise.all([
        WorkspaceMember.countDocuments({ workspaceId: m.workspaceId._id, status: MEMBER_STATUS.ACTIVE }),
        Project.countDocuments({ workspaceId: m.workspaceId._id, deletedAt: null }),
      ]);
      return { ...sanitize(m.workspaceId), myRole: m.role, memberCount, projectCount };
    })
  );

  return { items, meta: buildMeta({ page, limit, total }) };
};

// POST /workspaces — creator auto thành OWNER. Không có transaction trên standalone Mongo;
// nếu bước tạo member fail thì rollback workspace bằng tay.
const create = async (userId, payload) => {
  const owned = await Workspace.countDocuments({ ownerId: userId, deletedAt: null });
  if (owned >= LIMITS.WORKSPACE_OWNED_MAX) throw new ApiError('WORKSPACE_LIMIT_REACHED');

  const ws = await Workspace.create({
    name: payload.name,
    description: payload.description ?? null,
    ownerId: userId,
  });

  try {
    await WorkspaceMember.create({
      workspaceId: ws._id,
      userId,
      role: ROLE.OWNER,
      status: MEMBER_STATUS.ACTIVE,
    });
  } catch (err) {
    await Workspace.deleteOne({ _id: ws._id });
    throw err;
  }

  activityService.log({
    workspaceId: ws._id,
    actorId: userId,
    type: 'WORKSPACE_CREATED',
    entityLabel: ws.name,
  });

  return { ...sanitize(ws), myRole: ROLE.OWNER };
};

// GET /workspaces/:workspaceId — đã qua requireWorkspaceRole, có req.membership.
const getById = async (workspaceId, membership) => {
  const ws = await Workspace.findOne({ _id: workspaceId, deletedAt: null });
  if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');
  return { ...sanitize(ws), myRole: membership.role };
};

// PATCH /workspaces/:workspaceId — ADMIN+.
const update = async (workspaceId, payload) => {
  const ws = await Workspace.findOne({ _id: workspaceId, deletedAt: null });
  if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');

  if (payload.name !== undefined) ws.name = payload.name;
  if (payload.description !== undefined) ws.description = payload.description;
  if (payload.avatarUrl !== undefined) ws.avatarUrl = payload.avatarUrl;
  if (payload.settings) {
    if (payload.settings.memberCanCreateProject !== undefined) {
      ws.settings.memberCanCreateProject = payload.settings.memberCanCreateProject;
    }
    if (payload.settings.timezone !== undefined) {
      ws.settings.timezone = payload.settings.timezone;
    }
  }
  await ws.save();
  return sanitize(ws);
};

// DELETE /workspaces/:workspaceId — soft-delete, cascade xuống project/task/comment + cancel invitation.
const remove = async (workspaceId) => {
  const ws = await Workspace.findOne({ _id: workspaceId, deletedAt: null });
  if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');
  const now = new Date();
  await Promise.all([
    Workspace.updateOne({ _id: workspaceId }, { $set: { deletedAt: now } }),
    Project.updateMany({ workspaceId, deletedAt: null }, { $set: { deletedAt: now } }),
    Task.updateMany({ workspaceId, deletedAt: null }, { $set: { deletedAt: now } }),
    Comment.updateMany({ workspaceId, deletedAt: null }, { $set: { deletedAt: now } }),
    Invitation.updateMany(
      { workspaceId, status: INVITATION_STATUS.PENDING },
      { $set: { status: INVITATION_STATUS.CANCELLED } }
    ),
  ]);
  return { deleted: true };
};

// POST /workspaces/:workspaceId/transfer-ownership — caller phải là OWNER.
const transferOwnership = async (workspaceId, newOwnerId, callerId) => {
  if (String(newOwnerId) === String(callerId)) {
    throw new ApiError('VALIDATION_ERROR', undefined, [
      { field: 'body.newOwnerId', message: 'cannot transfer to yourself' },
    ]);
  }

  const ws = await Workspace.findOne({ _id: workspaceId, deletedAt: null });
  if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');

  const target = await WorkspaceMember.findOne({
    workspaceId,
    userId: newOwnerId,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (!target) throw new ApiError('USER_NOT_MEMBER');

  const oldOwner = await WorkspaceMember.findOne({
    workspaceId,
    userId: callerId,
    status: MEMBER_STATUS.ACTIVE,
    role: ROLE.OWNER,
  });
  if (!oldOwner) throw new ApiError('FORBIDDEN');

  // Cập nhật tuần tự — nếu lỗi giữa chừng, log lại để compensate sau (v1 acceptable).
  await WorkspaceMember.updateOne({ _id: oldOwner._id }, { $set: { role: ROLE.ADMIN } });
  await WorkspaceMember.updateOne({ _id: target._id }, { $set: { role: ROLE.OWNER } });
  await Workspace.updateOne({ _id: workspaceId }, { $set: { ownerId: newOwnerId } });

  return { transferred: true, ownerId: String(newOwnerId) };
};

// Lưu side-effect import để mongoose register model (linter friendly).
void mongoose;

module.exports = { list, create, getById, update, remove, transferOwnership };
