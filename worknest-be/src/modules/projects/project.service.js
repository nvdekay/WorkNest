const ApiError = require('../../common/errors/ApiError');
const { ROLE, TASK_STATUS } = require('../../common/constants');
const { parsePagination, buildMeta, parseSort } = require('../../common/utils/pagination');

const Project = require('./project.model');
const Workspace = require('../workspaces/workspace.model');
const Task = require('../tasks/task.model');
const Comment = require('../comments/comment.model');
const activityService = require('../activities/activity.service');

const SORTABLE = ['name', 'createdAt', 'updatedAt'];

const sanitize = (p) => ({
  _id: p._id,
  workspaceId: p.workspaceId,
  name: p.name,
  description: p.description,
  key: p.key,
  color: p.color,
  statuses: p.statuses,
  taskCounter: p.taskCounter,
  createdBy: p.createdBy,
  archivedAt: p.archivedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

// Suy ra key 2–6 ký tự [A-Z0-9] từ name; thử các hậu tố số nếu trùng trong workspace.
const deriveKey = async (workspaceId, name) => {
  let base = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (base.length < 2) base = 'PRJ';

  // Thử base, rồi base + 2..99 (cắt bớt để vẫn ≤ 6 ký tự).
  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base.slice(0, 6 - String(i + 1).length)}${i + 1}`;
    if (candidate.length < 2 || candidate.length > 6) continue;
    // eslint-disable-next-line no-await-in-loop
    const dup = await Project.findOne({ workspaceId, key: candidate });
    if (!dup) return candidate;
  }
  throw new ApiError('PROJECT_KEY_TAKEN');
};

// GET /workspaces/:workspaceId/projects — Member.
const list = async (workspaceId, query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE);
  const sortSpec = Object.keys(sort).length ? sort : { createdAt: -1 };

  const filter = { workspaceId, deletedAt: null };

  const archived = query.archived || 'false';
  if (archived === 'false') filter.archivedAt = null;
  else if (archived === 'true') filter.archivedAt = { $ne: null };
  // 'all' → không thêm filter

  if (query.search) {
    const needle = query.search.trim();
    filter.$or = [
      { name: { $regex: needle, $options: 'i' } },
      { key: { $regex: needle.toUpperCase(), $options: 'i' } },
    ];
  }

  const [docs, total] = await Promise.all([
    Project.find(filter).sort(sortSpec).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  const items = await Promise.all(
    docs.map(async (p) => {
      const [taskCount, doneCount] = await Promise.all([
        Task.countDocuments({ projectId: p._id, deletedAt: null }),
        Task.countDocuments({ projectId: p._id, deletedAt: null, status: TASK_STATUS.DONE }),
      ]);
      const progress = taskCount === 0 ? 0 : doneCount / taskCount;
      return { ...sanitize(p), taskCount, doneCount, progress };
    })
  );

  return { items, meta: buildMeta({ page, limit, total }) };
};

// POST /workspaces/:workspaceId/projects — Member nếu cờ workspace cho phép; ADMIN+ luôn được.
const create = async (workspaceId, payload, actor, membership) => {
  if (membership.role === ROLE.MEMBER) {
    const ws = await Workspace.findOne({ _id: workspaceId, deletedAt: null });
    if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');
    if (!ws.settings?.memberCanCreateProject) throw new ApiError('FORBIDDEN');
  }

  let key = payload.key ? payload.key.toUpperCase() : await deriveKey(workspaceId, payload.name);

  if (payload.key) {
    const dup = await Project.findOne({ workspaceId, key });
    if (dup) throw new ApiError('PROJECT_KEY_TAKEN');
  }

  const project = await Project.create({
    workspaceId,
    name: payload.name,
    description: payload.description ?? null,
    key,
    color: payload.color ?? null,
    createdBy: actor._id,
  });

  activityService.log({
    workspaceId,
    projectId: project._id,
    actorId: actor._id,
    type: 'PROJECT_CREATED',
    entityLabel: project.name,
  });

  return sanitize(project);
};

const findActive = async (workspaceId, projectId) => {
  const project = await Project.findOne({ _id: projectId, workspaceId, deletedAt: null });
  if (!project) throw new ApiError('PROJECT_NOT_FOUND');
  return project;
};

// GET /workspaces/:workspaceId/projects/:projectId — Member.
const getById = async (workspaceId, projectId) => {
  const project = await findActive(workspaceId, projectId);
  return sanitize(project);
};

// PATCH /workspaces/:workspaceId/projects/:projectId — ADMIN+ | MEMBER là createdBy.
const update = async (workspaceId, projectId, payload, actor, membership) => {
  const project = await findActive(workspaceId, projectId);

  if (membership.role === ROLE.MEMBER && String(project.createdBy) !== String(actor._id)) {
    throw new ApiError('FORBIDDEN');
  }
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  if (payload.name !== undefined) project.name = payload.name;
  if (payload.description !== undefined) project.description = payload.description;
  if (payload.color !== undefined) project.color = payload.color;

  if (payload.statuses) {
    // Phải chứa đúng 4 key chuẩn — không cho thêm/bớt cột v1.
    const provided = payload.statuses.map((s) => s.key).sort().join(',');
    const expected = ['DONE', 'IN_PROGRESS', 'IN_REVIEW', 'TODO'].join(',');
    if (provided !== expected) throw new ApiError('VALIDATION_ERROR');
    project.statuses = payload.statuses;
  }

  await project.save();
  return sanitize(project);
};

// POST /workspaces/:workspaceId/projects/:projectId/archive — ADMIN+.
const archive = async (workspaceId, projectId, archived) => {
  const project = await findActive(workspaceId, projectId);
  project.archivedAt = archived ? new Date() : null;
  await project.save();
  return sanitize(project);
};

// DELETE /workspaces/:workspaceId/projects/:projectId — ADMIN+; soft-delete + cascade task/comment.
const remove = async (workspaceId, projectId) => {
  const project = await findActive(workspaceId, projectId);
  const now = new Date();

  // Comment chỉ có taskId/workspaceId — phải tìm theo task của project.
  const taskIds = await Task.find({ projectId: project._id, deletedAt: null }).distinct('_id');

  await Promise.all([
    Project.updateOne({ _id: project._id }, { $set: { deletedAt: now } }),
    Task.updateMany({ projectId: project._id, deletedAt: null }, { $set: { deletedAt: now } }),
    taskIds.length
      ? Comment.updateMany({ taskId: { $in: taskIds }, deletedAt: null }, { $set: { deletedAt: now } })
      : Promise.resolve(),
  ]);
  return { deleted: true };
};

module.exports = { list, create, getById, update, archive, remove };
