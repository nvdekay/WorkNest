const jwt = require('jsonwebtoken');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

const register = async ({ name, email, password }) => {
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already in use');
  const user = await User.create({ name, email, password });
  return { user, token: signToken(user) };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');
  const valid = await user.comparePassword(password);
  if (!valid) throw new ApiError(401, 'Invalid email or password');
  user.password = undefined;
  return { user, token: signToken(user) };
};

module.exports = { register, login };
