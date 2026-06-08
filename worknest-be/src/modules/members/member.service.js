const ApiError = require('../../common/errors/ApiError');
const { ROLE, MEMBER_STATUS } = require('../../common/constants');
const { parsePagination, buildMeta, parseSort } = require('../../common/utils/pagination');

const WorkspaceMember = require('../workspaces/workspaceMember.model');
const Task = require('../tasks/task.model');
const activityService = require('../activities/activity.service');
const notificationService = require('../notifications/notification.service');

const SORTABLE = ['joinedAt', 'role', 'createdAt', 'updatedAt'];

const shape = (m) => ({
  membershipId: m._id,
  user: m.userId
    ? { _id: m.userId._id, name: m.userId.name, email: m.userId.email, avatarUrl: m.userId.avatarUrl }
    : null,
  role: m.role,
  status: m.status,
  joinedAt: m.joinedAt,
});

// GET /workspaces/:workspaceId/members
const list = async (workspaceId, query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE);
  const sortSpec = Object.keys(sort).length ? sort : { joinedAt: -1 };

  const filter = { workspaceId };
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  // Search theo name/email → populate match + filter null.
  const search = (query.search || '').trim();
  const populateMatch = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }
    : undefined;

  if (search) {
    // Khi có search phải fetch toàn bộ rồi filter để tránh trang rỗng.
    const all = await WorkspaceMember.find(filter)
      .populate({ path: 'userId', select: 'name email avatarUrl', match: populateMatch })
      .sort(sortSpec);
    const matched = all.filter((m) => m.userId);
    const total = matched.length;
    const items = matched.slice(skip, skip + limit).map(shape);
    return { items, meta: buildMeta({ page, limit, total }) };
  }

  const [docs, total] = await Promise.all([
    WorkspaceMember.find(filter)
      .populate({ path: 'userId', select: 'name email avatarUrl' })
      .sort(sortSpec)
      .skip(skip)
      .limit(limit),
    WorkspaceMember.countDocuments(filter),
  ]);
  return { items: docs.map(shape), meta: buildMeta({ page, limit, total }) };
};

// PATCH /workspaces/:workspaceId/members/:memberId/role — OWNER only.
const updateRole = async (workspaceId, memberId, newRole, actor) => {
  if (newRole === ROLE.OWNER) throw new ApiError('VALIDATION_ERROR');

  const target = await WorkspaceMember.findOne({
    _id: memberId,
    workspaceId,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (!target) throw new ApiError('MEMBER_NOT_FOUND');

  if (String(target.userId) === String(actor._id)) throw new ApiError('FORBIDDEN');
  if (target.role === ROLE.OWNER) throw new ApiError('CANNOT_MODIFY_OWNER');
  if (target.role === newRole) return { membershipId: target._id, role: target.role };

  target.role = newRole;
  await target.save();

  notificationService.emit({
    userId: target.userId,
    workspaceId,
    type: 'ROLE_CHANGED',
    title: `Your role has been changed to ${newRole}`,
    entityType: 'WORKSPACE',
    entityId: workspaceId,
    actorId: actor._id,
  });

  return { membershipId: target._id, role: target.role };
};

// DELETE /workspaces/:workspaceId/members/:memberId — ADMIN+; ADMIN chỉ xóa được MEMBER.
const remove = async (workspaceId, memberId, actor) => {
  const target = await WorkspaceMember.findOne({
    _id: memberId,
    workspaceId,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (!target) throw new ApiError('MEMBER_NOT_FOUND');

  if (target.role === ROLE.OWNER) throw new ApiError('CANNOT_REMOVE_OWNER');
  if (String(target.userId) === String(actor._id)) throw new ApiError('FORBIDDEN');

  const callerMembership = await WorkspaceMember.findOne({
    workspaceId,
    userId: actor._id,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (!callerMembership) throw new ApiError('FORBIDDEN');
  // ADMIN chỉ xóa được MEMBER (OWNER thì xóa ai cũng được, trừ chính mình & OWNER khác — không có).
  if (callerMembership.role === ROLE.ADMIN && target.role !== ROLE.MEMBER) {
    throw new ApiError('FORBIDDEN');
  }

  target.status = MEMBER_STATUS.REMOVED;
  await target.save();

  await unassignTasksAndLog(workspaceId, target.userId, actor._id);

  notificationService.emit({
    userId: target.userId,
    workspaceId,
    type: 'REMOVED_FROM_WORKSPACE',
    title: 'You have been removed from a workspace',
    entityType: 'WORKSPACE',
    entityId: workspaceId,
    actorId: actor._id,
  });

  return { removed: true, membershipId: target._id };
};

// POST /workspaces/:workspaceId/members/leave — Member; OWNER không được rời.
const leave = async (workspaceId, userId) => {
  const me = await WorkspaceMember.findOne({
    workspaceId,
    userId,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (!me) throw new ApiError('MEMBER_NOT_FOUND');
  if (me.role === ROLE.OWNER) throw new ApiError('OWNER_CANNOT_LEAVE');

  me.status = MEMBER_STATUS.REMOVED;
  await me.save();

  await unassignTasksAndLog(workspaceId, userId, userId);

  return { left: true };
};

// Helper: bỏ giao mọi task của user trong workspace, ghi activity per task.
const unassignTasksAndLog = async (workspaceId, userId, actorId) => {
  const tasks = await Task.find({
    workspaceId,
    assignee: userId,
    deletedAt: null,
  }).select('_id projectId title');
  if (!tasks.length) return;

  await Task.updateMany(
    { _id: { $in: tasks.map((t) => t._id) } },
    { $set: { assignee: null } }
  );

  for (const t of tasks) {
    activityService.log({
      workspaceId,
      projectId: t.projectId,
      taskId: t._id,
      actorId,
      type: 'TASK_UNASSIGNED',
      entityLabel: t.title,
    });
  }
};

module.exports = { list, updateRole, remove, leave };
