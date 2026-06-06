const catchAsync = require('../../utils/catchAsync');
const { success, created } = require('../../utils/apiResponse');
const userService = require('./user.service');

const create = catchAsync(async (req, res) => {
  const user = await userService.create(req.body);
  return created(res, user, 'User created');
});

const list = catchAsync(async (req, res) => {
  const result = await userService.list(req.query);
  return success(res, result);
});

const getById = catchAsync(async (req, res) => {
  const user = await userService.getById(req.params.id);
  return success(res, user);
});

const update = catchAsync(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  return success(res, user, 'User updated');
});

const remove = catchAsync(async (req, res) => {
  await userService.remove(req.params.id);
  return success(res, null, 'User deleted');
});

module.exports = { create, list, getById, update, remove };
