const catchAsync = require('../../utils/catchAsync');
const { success, created } = require('../../utils/apiResponse');
const authService = require('./auth.service');

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  return created(res, result, 'Registered');
});

const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  return success(res, result, 'Logged in');
});

const me = catchAsync(async (req, res) => {
  return success(res, req.user);
});

module.exports = { register, login, me };
