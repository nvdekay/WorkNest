const ApiError = require('../errors/ApiError');

const notFound = (req, _res, next) => {
  next(new ApiError('NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = notFound;
