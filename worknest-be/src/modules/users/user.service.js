const ApiError = require('../../common/errors/ApiError');
const User = require('./user.model');

const sanitize = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  emailVerified: u.emailVerified,
});

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError('UNAUTHENTICATED');
  return sanitize(user);
};

const updateMe = async (userId, payload) => {
  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.avatarUrl !== undefined) updates.avatarUrl = payload.avatarUrl;
  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError('UNAUTHENTICATED');
  return sanitize(user);
};

// `file` từ multer; `baseUrl` để dựng URL tuyệt đối có thể truy cập trực tiếp.
const uploadAvatar = async (userId, file, baseUrl) => {
  if (!file) throw new ApiError('INVALID_FILE', 'No file uploaded (field "file" required).');
  const avatarUrl = `${baseUrl}/uploads/avatars/${file.filename}`;
  const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true });
  if (!user) throw new ApiError('UNAUTHENTICATED');
  return { avatarUrl };
};

module.exports = { getMe, updateMe, uploadAvatar };
