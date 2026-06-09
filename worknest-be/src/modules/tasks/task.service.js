const mongoose = require('mongoose');

const ApiError = require('../../common/errors/ApiError');
const {
  ROLE,
  MEMBER_STATUS,
  TASK_STATUS,
  LIMITS,
} = require('../../common/constants');
const { parsePagination, buildMeta, parseSort } = require('../../common/utils/pagination');

const Task = require('./task.model');
const Project = require('../projects/project.model');
const Comment = require('../comments/comment.model');
const WorkspaceMember = require('../workspaces/workspaceMember.model');
const activityService = require('../activities/activity.service');
const notificationService = require('../notifications/notification.service');

const LIST_SORTABLE = ['createdAt', 'dueDate', 'priority', 'position'];
const BOARD_COLUMN_LIMIT = 50;
const PRIORITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

const isOid = (v) => mongoose.isValidObjectId(v);

const csv = (raw) =>
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// ---------- helpers ----------

const findActiveProject = async (workspaceId, projectId) => {
  const project = await Project.findOne({ _id: projectId, workspaceId, deletedAt: null });
  if (!project) throw new ApiError('PROJECT_NOT_FOUND');
  return project;
};

const findActiveTask = async (workspaceId, projectId, taskId) => {
  const task = await Task.findOne({ _id: taskId, workspaceId, projectId, deletedAt: null });
  if (!task) throw new ApiError('TASK_NOT_FOUND');
  return task;
};

const ensureActiveMember = async (workspaceId, userId) => {
  if (!userId) return null;
  const m = await WorkspaceMember.findOne({
    workspaceId,
    userId,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (!m) throw new ApiError('ASSIGNEE_NOT_MEMBER');
  return m;
};

// MEMBER chỉ sửa task khi là createdBy hoặc assignee; xóa thì chỉ createdBy.
const canEdit = (membership, task) => {
  if (membership.role !== ROLE.MEMBER) return true;
  const uid = String(membership.userId);
  return String(task.createdBy) === uid || (task.assignee && String(task.assignee) === uid);
};
const canDelete = (membership, task) => {
  if (membership.role !== ROLE.MEMBER) return true;
  return String(task.createdBy) === String(membership.userId);
};

// Tập trung kiểm tra status transition (v1: any-to-any, chỉ check whitelist + archive).
const ensureStatusAllowed = (project, newStatus) => {
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');
  const allowed = project.statuses.map((s) => s.key);
  if (!allowed.includes(newStatus)) throw new ApiError('INVALID_STATUS_TRANSITION');
};

// Position thưa float: max-trong-cột + 1024.
const nextPositionFor = async (projectId, status) => {
  const top = await Task.findOne({ projectId, status, deletedAt: null })
    .sort({ position: -1 })
    .select('position');
  return (top?.position ?? 0) + 1024;
};

const sanitize = (t) => {
  const obj = typeof t.toObject === 'function' ? t.toObject({ virtuals: true }) : t;
  return obj;
};

// ---------- list ----------

const buildFilter = (workspaceId, projectId, query, userId) => {
  const filter = { workspaceId, projectId, deletedAt: null };

  if (query.status) {
    const arr = csv(query.status);
    if (arr.length) filter.status = { $in: arr };
  }
  if (query.priority) {
    const arr = csv(query.priority);
    if (arr.length) filter.priority = { $in: arr };
  }
  if (query.label) {
    filter['labels.name'] = { $in: csv(query.label) };
  }
  if (query.assignee) {
    if (query.assignee === 'me') filter.assignee = userId;
    else if (query.assignee === 'none') filter.assignee = null;
    else if (isOid(query.assignee)) filter.assignee = query.assignee;
  }
  if (query.dueFrom || query.dueTo) {
    filter.dueDate = {};
    if (query.dueFrom) filter.dueDate.$gte = new Date(query.dueFrom);
    if (query.dueTo) filter.dueDate.$lte = new Date(query.dueTo);
  }
  if (query.overdue === 'true') {
    filter.dueDate = { ...(filter.dueDate || {}), $lt: new Date() };
    filter.status = filter.status
      ? { $in: filter.status.$in.filter((s) => s !== TASK_STATUS.DONE) }
      : { $ne: TASK_STATUS.DONE };
  }
  if (query.search) {
    const needle = query.search.trim();
    filter.$or = [
      { title: { $regex: needle, $options: 'i' } },
      { taskCode: { $regex: needle, $options: 'i' } },
    ];
  }
  return filter;
};

const list = async (workspaceId, projectId, query = {}, userId) => {
  const project = await findActiveProject(workspaceId, projectId);
  const view = query.view || 'board';
  const filter = buildFilter(workspaceId, projectId, query, userId);

  if (view === 'list') {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, LIST_SORTABLE);
    const sortSpec = Object.keys(sort).length ? sort : { createdAt: -1 };
    const [docs, total] = await Promise.all([
      Task.find(filter)
        .populate('assignee', 'name email avatarUrl')
        .populate('createdBy', 'name email avatarUrl')
        .sort(sortSpec)
        .skip(skip)
        .limit(limit),
      Task.countDocuments(filter),
    ]);
    return { items: docs.map(sanitize), meta: buildMeta({ page, limit, total }) };
  }

  // board: nhóm theo project.statuses, mỗi cột top-N theo position.
  const columns = await Promise.all(
    project.statuses
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(async (s) => {
        const colFilter = { ...filter, status: s.key };
        // Nếu status filter đã có $in mà bỏ qua key này → cột rỗng.
        if (filter.status?.$in && !filter.status.$in.includes(s.key)) {
          return { status: s.key, label: s.label, tasks: [], total: 0 };
        }
        const [tasks, total] = await Promise.all([
          Task.find(colFilter)
            .populate('assignee', 'name email avatarUrl')
            .sort({ position: 1 })
            .limit(BOARD_COLUMN_LIMIT),
          Task.countDocuments(colFilter),
        ]);
        return { status: s.key, label: s.label, tasks: tasks.map(sanitize), total };
      })
  );

  return { columns };
};

// ---------- create ----------

const create = async (workspaceId, projectId, payload, actor) => {
  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  const status = payload.status || TASK_STATUS.TODO;
  ensureStatusAllowed(project, status);

  if (payload.assigneeId) await ensureActiveMember(workspaceId, payload.assigneeId);

  // Tăng nguyên tử taskCounter để lấy mã. Atomic findOneAndUpdate.
  const incremented = await Project.findOneAndUpdate(
    { _id: project._id, deletedAt: null, archivedAt: null },
    { $inc: { taskCounter: 1 } },
    { new: true }
  );
  if (!incremented) throw new ApiError('PROJECT_ARCHIVED');
  const taskCode = `${incremented.key}-${incremented.taskCounter}`;

  const position = await nextPositionFor(project._id, status);

  const task = await Task.create({
    workspaceId,
    projectId: project._id,
    taskCode,
    title: payload.title.trim(),
    description: payload.description ?? null,
    status,
    priority: payload.priority || 'MEDIUM',
    position,
    assignee: payload.assigneeId || null,
    createdBy: actor._id,
    dueDate: payload.dueDate || null,
    startDate: payload.startDate || null,
    completedAt: status === TASK_STATUS.DONE ? new Date() : null,
    labels: payload.labels || [],
  });

  activityService.log({
    workspaceId,
    projectId: project._id,
    taskId: task._id,
    actorId: actor._id,
    type: 'TASK_CREATED',
    entityLabel: task.title,
    metadata: { taskCode },
  });

  if (task.assignee) {
    activityService.log({
      workspaceId,
      projectId: project._id,
      taskId: task._id,
      actorId: actor._id,
      type: 'TASK_ASSIGNED',
      entityLabel: task.title,
      metadata: { assigneeId: task.assignee },
    });
    // Tự giao cho mình → không thông báo.
    if (String(task.assignee) !== String(actor._id)) {
      notificationService.emit({
        userId: task.assignee,
        workspaceId,
        type: 'TASK_ASSIGNED',
        title: `You were assigned to ${taskCode} — ${task.title}`,
        entityType: 'TASK',
        entityId: task._id,
        actorId: actor._id,
      });
    }
  }

  return sanitize(task);
};

// ---------- getById ----------

const getById = async (workspaceId, projectId, taskId) => {
  const task = await Task.findOne({ _id: taskId, workspaceId, projectId, deletedAt: null })
    .populate('assignee', 'name email avatarUrl')
    .populate('createdBy', 'name email avatarUrl')
    .populate('watchers', 'name email avatarUrl');
  if (!task) throw new ApiError('TASK_NOT_FOUND');
  return sanitize(task);
};

// ---------- update ----------

const update = async (workspaceId, projectId, taskId, payload, actor, membership) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  if (!canEdit(membership, task)) throw new ApiError('FORBIDDEN');

  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  // Validate cross-field date: gộp giá trị hiện tại với payload để check.
  const startDate = payload.startDate !== undefined ? payload.startDate : task.startDate;
  const dueDate = payload.dueDate !== undefined ? payload.dueDate : task.dueDate;
  if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
    throw new ApiError('VALIDATION_ERROR', undefined, [
      { field: 'body.dueDate', message: 'startDate must be ≤ dueDate' },
    ]);
  }

  const oldStatus = task.status;
  const oldAssignee = task.assignee ? String(task.assignee) : null;
  const oldPriority = task.priority;
  const oldDue = task.dueDate ? task.dueDate.getTime() : null;
  const oldTitle = task.title;

  if (payload.title !== undefined) task.title = payload.title.trim();
  if (payload.description !== undefined) task.description = payload.description;
  if (payload.priority !== undefined) task.priority = payload.priority;
  if (payload.position !== undefined) task.position = payload.position;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate;
  if (payload.startDate !== undefined) task.startDate = payload.startDate;
  if (payload.labels !== undefined) task.labels = payload.labels;

  if (payload.status !== undefined && payload.status !== oldStatus) {
    ensureStatusAllowed(project, payload.status);
    task.status = payload.status;
    if (payload.status === TASK_STATUS.DONE) task.completedAt = new Date();
    else if (oldStatus === TASK_STATUS.DONE) task.completedAt = null;
  }

  if (payload.assigneeId !== undefined) {
    if (payload.assigneeId) await ensureActiveMember(workspaceId, payload.assigneeId);
    task.assignee = payload.assigneeId || null;
  }

  await task.save();

  // ----- side-effects (activities + notifications) -----
  const ctx = { workspaceId, projectId, taskId: task._id, actorId: actor._id, entityLabel: task.title };

  if (task.status !== oldStatus) {
    activityService.log({
      ...ctx,
      type: 'TASK_STATUS_CHANGED',
      metadata: { from: oldStatus, to: task.status },
    });
    // Thông báo assignee + watchers, trừ actor.
    const audience = new Set();
    if (task.assignee) audience.add(String(task.assignee));
    for (const w of task.watchers || []) audience.add(String(w));
    audience.delete(String(actor._id));
    for (const userId of audience) {
      notificationService.emit({
        userId,
        workspaceId,
        type: 'TASK_STATUS_CHANGED',
        title: `${task.taskCode} → ${task.status}`,
        entityType: 'TASK',
        entityId: task._id,
        actorId: actor._id,
      });
    }
  }

  const newAssignee = task.assignee ? String(task.assignee) : null;
  if (newAssignee !== oldAssignee) {
    if (newAssignee) {
      activityService.log({
        ...ctx,
        type: 'TASK_ASSIGNED',
        metadata: { assigneeId: newAssignee, previousAssigneeId: oldAssignee },
      });
      if (newAssignee !== String(actor._id)) {
        notificationService.emit({
          userId: newAssignee,
          workspaceId,
          type: 'TASK_ASSIGNED',
          title: `You were assigned to ${task.taskCode} — ${task.title}`,
          entityType: 'TASK',
          entityId: task._id,
          actorId: actor._id,
        });
      }
    } else {
      activityService.log({
        ...ctx,
        type: 'TASK_UNASSIGNED',
        metadata: { previousAssigneeId: oldAssignee },
      });
    }
  }

  if (payload.priority !== undefined && payload.priority !== oldPriority) {
    activityService.log({
      ...ctx,
      type: 'TASK_PRIORITY_CHANGED',
      metadata: { from: oldPriority, to: task.priority },
    });
  }
  if (payload.dueDate !== undefined) {
    const newDue = task.dueDate ? task.dueDate.getTime() : null;
    if (newDue !== oldDue) {
      activityService.log({
        ...ctx,
        type: 'TASK_DUE_CHANGED',
        metadata: { from: oldDue, to: newDue },
      });
    }
  }
  if (payload.title !== undefined && task.title !== oldTitle) {
    activityService.log({
      ...ctx,
      type: 'TASK_RENAMED',
      metadata: { from: oldTitle, to: task.title },
    });
  }

  return sanitize(task);
};

// ---------- remove (soft-delete + cascade comments) ----------

const remove = async (workspaceId, projectId, taskId, actor, membership) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  if (!canDelete(membership, task)) throw new ApiError('FORBIDDEN');

  const now = new Date();
  await Promise.all([
    Task.updateOne({ _id: task._id }, { $set: { deletedAt: now } }),
    Comment.updateMany({ taskId: task._id, deletedAt: null }, { $set: { deletedAt: now } }),
  ]);

  activityService.log({
    workspaceId,
    projectId,
    taskId: task._id,
    actorId: actor._id,
    type: 'TASK_DELETED',
    entityLabel: task.title,
    metadata: { taskCode: task.taskCode },
  });

  return { deleted: true };
};

// ---------- checklist ----------

const addChecklist = async (workspaceId, projectId, taskId, text, _actor, membership) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  if (!canEdit(membership, task)) throw new ApiError('FORBIDDEN');
  if (task.checklist.length >= LIMITS.CHECKLIST_MAX) throw new ApiError('CHECKLIST_LIMIT');
  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  const order = task.checklist.length;
  task.checklist.push({ text, done: false, order });
  await task.save();
  return task.checklist[task.checklist.length - 1];
};

const updateChecklistItem = async (workspaceId, projectId, taskId, itemId, patch, _actor, membership) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  if (!canEdit(membership, task)) throw new ApiError('FORBIDDEN');
  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  const item = task.checklist.id(itemId);
  if (!item) throw new ApiError('NOT_FOUND');
  if (patch.text !== undefined) item.text = patch.text;
  if (patch.done !== undefined) item.done = patch.done;
  if (patch.order !== undefined) item.order = patch.order;
  await task.save();
  return item;
};

const removeChecklistItem = async (workspaceId, projectId, taskId, itemId, _actor, membership) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  if (!canEdit(membership, task)) throw new ApiError('FORBIDDEN');
  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  const item = task.checklist.id(itemId);
  if (!item) throw new ApiError('NOT_FOUND');
  item.deleteOne();
  await task.save();
  return { removed: true, itemId };
};

// ---------- attachments ----------

const addAttachment = async (workspaceId, projectId, taskId, file, actor, membership, baseUrl) => {
  if (!file) throw new ApiError('INVALID_FILE', 'Missing file');
  const task = await findActiveTask(workspaceId, projectId, taskId);
  if (!canEdit(membership, task)) throw new ApiError('FORBIDDEN');
  if (task.attachments.length >= LIMITS.ATTACHMENTS_MAX) throw new ApiError('INVALID_FILE', 'attachments limit reached');
  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  const fileUrl = `${baseUrl}/uploads/attachments/${file.filename}`;
  task.attachments.push({
    fileName: file.originalname,
    fileUrl,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedBy: actor._id,
  });
  await task.save();
  const att = task.attachments[task.attachments.length - 1];

  activityService.log({
    workspaceId,
    projectId,
    taskId: task._id,
    actorId: actor._id,
    type: 'TASK_ATTACHMENT_ADDED',
    entityLabel: task.title,
    metadata: { fileName: att.fileName },
  });

  return att;
};

const removeAttachment = async (workspaceId, projectId, taskId, attachmentId, actor, membership) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  const att = task.attachments.id(attachmentId);
  if (!att) throw new ApiError('NOT_FOUND');

  // Người upload hoặc ADMIN+; MEMBER khác không được xóa attachment của người khác.
  const isUploader = String(att.uploadedBy) === String(actor._id);
  const isAdminPlus = membership.role === ROLE.ADMIN || membership.role === ROLE.OWNER;
  if (!isUploader && !isAdminPlus) throw new ApiError('FORBIDDEN');

  const project = await findActiveProject(workspaceId, projectId);
  if (project.archivedAt) throw new ApiError('PROJECT_ARCHIVED');

  att.deleteOne();
  await task.save();
  return { removed: true, attachmentId };
};

// ---------- watch ----------

const watch = async (workspaceId, projectId, taskId, userId) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  const exists = task.watchers.some((w) => String(w) === String(userId));
  if (!exists) {
    task.watchers.push(userId);
    await task.save();
  }
  return { watching: true };
};

const unwatch = async (workspaceId, projectId, taskId, userId) => {
  const task = await findActiveTask(workspaceId, projectId, taskId);
  const before = task.watchers.length;
  task.watchers = task.watchers.filter((w) => String(w) !== String(userId));
  if (task.watchers.length !== before) await task.save();
  return { watching: false };
};

// Silence unused-warning cho PRIORITY_RANK — dùng cho future sort hook.
void PRIORITY_RANK;

module.exports = {
  list, create, getById, update, remove,
  addChecklist, updateChecklistItem, removeChecklistItem,
  addAttachment, removeAttachment,
  watch, unwatch,
};
