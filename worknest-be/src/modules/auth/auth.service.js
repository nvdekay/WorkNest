const crypto = require('crypto');

const ApiError = require('../../common/errors/ApiError');
const { MEMBER_STATUS } = require('../../common/constants');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  decode,
} = require('../../common/utils/jwt');

const User = require('../users/user.model');
const RefreshToken = require('./refreshToken.model');
// Side-effect requires: đảm bảo Workspace/WorkspaceMember model được register
// trước khi populate trong me().
const Workspace = require('../workspaces/workspace.model');
const WorkspaceMember = require('../workspaces/workspaceMember.model');

const sanitize = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
});

// Sinh cặp token + lưu jti vào whitelist. `decode` chỉ đọc exp đã có sẵn trong token.
const issueTokens = async (user) => {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id, jti);
  const { exp } = decode(refreshToken);
  await RefreshToken.create({
    jti,
    userId: user._id,
    expiresAt: new Date(exp * 1000),
  });
  return { accessToken, refreshToken };
};

const register = async ({ name, email, password }) => {
  const exists = await User.exists({ email });
  if (exists) throw new ApiError('EMAIL_TAKEN');

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();

  const tokens = await issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

// Lỗi sai email / sai password đều trả CÙNG `INVALID_CREDENTIALS` để tránh user enumeration.
const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw new ApiError('INVALID_CREDENTIALS');

  const ok = await user.comparePassword(password);
  if (!ok) throw new ApiError('INVALID_CREDENTIALS');

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

// Rotate: verify → check whitelist → delete old jti → issue new pair.
const refresh = async (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken); // errorHandler map JWT errors → TOKEN_INVALID/EXPIRED

  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored) throw new ApiError('TOKEN_INVALID');

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError('TOKEN_INVALID');

  await RefreshToken.deleteOne({ jti: payload.jti });
  return issueTokens(user);
};

// Idempotent — token sai/hết hạn vẫn coi như đã logout.
const logout = async (refreshToken) => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await RefreshToken.deleteOne({ jti: payload.jti });
  } catch (_err) {
    /* ignore */
  }
  return { loggedOut: true };
};

const me = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError('UNAUTHENTICATED');

  const memberships = await WorkspaceMember.find({
    userId,
    status: MEMBER_STATUS.ACTIVE,
  })
    .populate({ path: 'workspaceId', match: { deletedAt: null }, select: 'name' })
    .lean();

  const workspaces = memberships
    .filter((m) => m.workspaceId) // loại workspace đã xóa mềm (populate match trả null)
    .map((m) => ({ _id: m.workspaceId._id, name: m.workspaceId.name, role: m.role }));

  return { user: sanitize(user), workspaces };
};

// Đổi mật khẩu thành công → thu hồi mọi refresh token để buộc đăng nhập lại trên thiết bị khác.
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new ApiError('UNAUTHENTICATED');

  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw new ApiError('INVALID_CREDENTIALS');

  await user.setPassword(newPassword);
  await user.save();
  await RefreshToken.deleteMany({ userId });

  return { changed: true };
};

// Đảm bảo các model side-effect-require không bị tree-shake (linter friendly).
void Workspace;

module.exports = { register, login, refresh, logout, me, changePassword };
