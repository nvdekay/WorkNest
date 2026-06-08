const crypto = require('crypto');

const ApiError = require('../../common/errors/ApiError');
const logger = require('../../config/logger');
const {
  ROLE,
  MEMBER_STATUS,
  INVITATION_STATUS,
  LIMITS,
} = require('../../common/constants');
const { parsePagination, buildMeta, parseSort } = require('../../common/utils/pagination');

const Invitation = require('../workspaces/invitation.model');
const Workspace = require('../workspaces/workspace.model');
const WorkspaceMember = require('../workspaces/workspaceMember.model');
const User = require('../users/user.model');
const activityService = require('../activities/activity.service');
const notificationService = require('../notifications/notification.service');

const SORTABLE = ['createdAt', 'expiresAt', 'email'];
const TTL_MS = LIMITS.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

const generateToken = () => crypto.randomBytes(32).toString('hex');

const shape = (inv) => ({
  _id: inv._id,
  workspaceId: inv.workspaceId,
  email: inv.email,
  role: inv.role,
  status: inv.status,
  invitedBy: inv.invitedBy,
  expiresAt: inv.expiresAt,
  createdAt: inv.createdAt,
  updatedAt: inv.updatedAt,
});

// Stub gửi email — chỉ log; production sẽ thay bằng provider (SES/SendGrid/...).
const sendInvitationEmail = async ({ email, token, workspaceName, inviterName }) => {
  try {
    logger.info(
      { email, workspaceName, inviterName, token: '[REDACTED]' },
      '[invitation] email queued'
    );
  } catch (err) {
    logger.error({ err, email }, '[invitation] email send failed');
  }
};

// GET /workspaces/:workspaceId/invitations — ADMIN+. Token bị lược bởi toJSON.
const list = async (workspaceId, query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE);
  const sortSpec = Object.keys(sort).length ? sort : { createdAt: -1 };

  const filter = { workspaceId };
  if (query.status) filter.status = query.status;
  if (query.search) filter.email = { $regex: query.search.trim(), $options: 'i' };

  const [docs, total] = await Promise.all([
    Invitation.find(filter).sort(sortSpec).skip(skip).limit(limit),
    Invitation.countDocuments(filter),
  ]);
  return { items: docs.map(shape), meta: buildMeta({ page, limit, total }) };
};

// POST /workspaces/:workspaceId/invitations — ADMIN+; không mời OWNER.
const send = async (workspaceId, payload, actor) => {
  if (payload.role === ROLE.OWNER) throw new ApiError('VALIDATION_ERROR');
  const email = payload.email.toLowerCase().trim();

  const ws = await Workspace.findOne({ _id: workspaceId, deletedAt: null });
  if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');

  // ALREADY_MEMBER: user có email này đang là ACTIVE member.
  const existingUser = await User.findOne({ email }).select('_id name');
  if (existingUser) {
    const activeMembership = await WorkspaceMember.findOne({
      workspaceId,
      userId: existingUser._id,
      status: MEMBER_STATUS.ACTIVE,
    });
    if (activeMembership) throw new ApiError('ALREADY_MEMBER');
  }

  // INVITATION_EXISTS: đã có PENDING với cùng email/workspace.
  const pending = await Invitation.findOne({
    workspaceId,
    email,
    status: INVITATION_STATUS.PENDING,
  });
  if (pending) throw new ApiError('INVITATION_EXISTS');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_MS);

  const inv = await Invitation.create({
    workspaceId,
    email,
    role: payload.role,
    token,
    invitedBy: actor._id,
    expiresAt,
  });

  activityService.log({
    workspaceId,
    actorId: actor._id,
    type: 'MEMBER_INVITED',
    entityLabel: email,
    metadata: { role: payload.role },
  });

  // Email async — không await.
  sendInvitationEmail({ email, token, workspaceName: ws.name, inviterName: actor.name });

  // Nếu user đã tồn tại → bắn in-app notification.
  if (existingUser) {
    notificationService.emit({
      userId: existingUser._id,
      workspaceId,
      type: 'MEMBER_INVITED',
      title: `You've been invited to ${ws.name}`,
      entityType: 'INVITATION',
      entityId: inv._id,
      actorId: actor._id,
    });
  }

  return shape(inv);
};

// DELETE /workspaces/:workspaceId/invitations/:invitationId — ADMIN+.
const cancel = async (workspaceId, invitationId) => {
  const inv = await Invitation.findOne({ _id: invitationId, workspaceId });
  if (!inv) throw new ApiError('NOT_FOUND');
  if (inv.status !== INVITATION_STATUS.PENDING) throw new ApiError('INVITATION_NOT_PENDING');

  inv.status = INVITATION_STATUS.CANCELLED;
  await inv.save();
  return { cancelled: true, _id: inv._id };
};

// POST /invitations/accept — Auth.
const accept = async (token, user) => {
  const inv = await Invitation.findOne({ token }).select('+token');
  if (!inv) throw new ApiError('INVITATION_INVALID');

  if (inv.status !== INVITATION_STATUS.PENDING) throw new ApiError('INVITATION_INVALID');

  if (inv.expiresAt.getTime() < Date.now()) {
    inv.status = INVITATION_STATUS.EXPIRED;
    await inv.save();
    throw new ApiError('INVITATION_EXPIRED');
  }

  if (inv.email !== user.email.toLowerCase()) throw new ApiError('INVITATION_EMAIL_MISMATCH');

  const ws = await Workspace.findOne({ _id: inv.workspaceId, deletedAt: null });
  if (!ws) throw new ApiError('WORKSPACE_NOT_FOUND');

  // Idempotent-friendly: nếu đã là member ACTIVE thì vẫn coi như thành công, mark ACCEPTED.
  const existing = await WorkspaceMember.findOne({
    workspaceId: inv.workspaceId,
    userId: user._id,
  });

  if (existing && existing.status === MEMBER_STATUS.ACTIVE) {
    inv.status = INVITATION_STATUS.ACCEPTED;
    await inv.save();
    return { workspace: { _id: ws._id, name: ws.name }, role: existing.role };
  }

  if (existing) {
    existing.status = MEMBER_STATUS.ACTIVE;
    existing.role = inv.role;
    existing.joinedAt = new Date();
    await existing.save();
  } else {
    await WorkspaceMember.create({
      workspaceId: inv.workspaceId,
      userId: user._id,
      role: inv.role,
      status: MEMBER_STATUS.ACTIVE,
    });
  }

  inv.status = INVITATION_STATUS.ACCEPTED;
  await inv.save();

  activityService.log({
    workspaceId: inv.workspaceId,
    actorId: user._id,
    type: 'MEMBER_JOINED',
    entityLabel: user.email,
    metadata: { role: inv.role },
  });

  notificationService.emit({
    userId: inv.invitedBy,
    workspaceId: inv.workspaceId,
    type: 'MEMBER_JOINED',
    title: `${user.name} accepted your invitation`,
    entityType: 'WORKSPACE',
    entityId: inv.workspaceId,
    actorId: user._id,
  });

  return { workspace: { _id: ws._id, name: ws.name }, role: inv.role };
};

// GET /invitations/preview — Public; không tiêu thụ token.
const preview = async (token) => {
  const inv = await Invitation.findOne({ token })
    .select('+token workspaceId email role status expiresAt invitedBy')
    .populate({ path: 'workspaceId', select: 'name avatarUrl' })
    .populate({ path: 'invitedBy', select: 'name email avatarUrl' });
  if (!inv) throw new ApiError('INVITATION_INVALID');

  return {
    email: inv.email,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expiresAt,
    workspace: inv.workspaceId
      ? { _id: inv.workspaceId._id, name: inv.workspaceId.name, avatarUrl: inv.workspaceId.avatarUrl }
      : null,
    inviter: inv.invitedBy
      ? { _id: inv.invitedBy._id, name: inv.invitedBy.name, email: inv.invitedBy.email, avatarUrl: inv.invitedBy.avatarUrl }
      : null,
  };
};

module.exports = { list, send, cancel, accept, preview };
