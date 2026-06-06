const ApiError = require('../errors/ApiError');

// Stub dùng chung cho controller chưa triển khai.
const notImpl = (label) => (_req, _res, next) =>
  next(new ApiError('NOT_IMPLEMENTED', `${label} is not implemented yet.`));

module.exports = notImpl;
