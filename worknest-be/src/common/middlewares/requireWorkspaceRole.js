const mongoose = require('mongoose');
const ApiError = require('../errors/ApiError');
const { ROLE_RANK, MEMBER_STATUS } = require('../constants');

// requireWorkspaceRole(minRole) — chạy SAU requireAuth.
// Tìm bản ghi workspace_members(workspaceId, userId) status ACTIVE;
// gắn req.membership; từ chối 404 nếu không phải thành viên (chống IDOR),
// 403 nếu role thấp hơn ngưỡng.
const requireWorkspaceRole = (minRole = 'MEMBER') => async (req, _res, next) => {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.isValidObjectId(workspaceId)) throw new ApiError('INVALID_ID');

    const WorkspaceMember = require('../../modules/workspaces/workspaceMember.model');
    const membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.user._id,
      status: MEMBER_STATUS.ACTIVE,
    }).lean();

    if (!membership) throw new ApiError('WORKSPACE_NOT_FOUND');

    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ApiError('FORBIDDEN');
    }

    req.membership = membership;
    req.workspaceId = String(workspaceId);
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = requireWorkspaceRole;
