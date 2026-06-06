const asyncHandler = require('../../common/utils/asyncHandler');
const { ok } = require('../../common/utils/apiResponse');
const service = require('./user.service');

const getMe = asyncHandler(async (req, res) => {
  return ok(res, await service.getMe(req.user._id));
});

const updateMe = asyncHandler(async (req, res) => {
  return ok(res, await service.updateMe(req.user._id, req.body));
});

const uploadAvatar = asyncHandler(async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return ok(res, await service.uploadAvatar(req.user._id, req.file, baseUrl));
});

module.exports = { getMe, updateMe, uploadAvatar };
