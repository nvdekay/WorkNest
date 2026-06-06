const asyncHandler = require('../../common/utils/asyncHandler');
const { ok, created } = require('../../common/utils/apiResponse');
const service = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await service.register(req.body);
  return created(res, result);
});

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  return ok(res, result);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await service.refresh(req.body.refreshToken);
  return ok(res, result);
});

const logout = asyncHandler(async (req, res) => {
  const result = await service.logout(req.body.refreshToken);
  return ok(res, result);
});

const me = asyncHandler(async (req, res) => {
  const result = await service.me(req.user._id);
  return ok(res, result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await service.changePassword(req.user._id, req.body);
  return ok(res, result);
});

module.exports = { register, login, refresh, logout, me, changePassword };
