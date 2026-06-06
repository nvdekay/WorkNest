const User = require('./user.model');
const ApiError = require('../../utils/ApiError');

const create = async (payload) => {
  const exists = await User.findOne({ email: payload.email });
  if (exists) throw new ApiError(409, 'Email already in use');
  return User.create(payload);
};

const list = async ({ page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(),
  ]);
  return { items, total, page, limit };
};

const getById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

const update = async (id, payload) => {
  const user = await User.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

const remove = async (id) => {
  const user = await User.findByIdAndDelete(id);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

module.exports = { create, list, getById, update, remove };
