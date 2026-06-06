const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const ApiError = require('../errors/ApiError');
const ERROR_CODES = require('../errors/errorCodes');
const env = require('../../config/env');
const logger = require('../../config/logger');

const buildBody = (err, req) => ({
  success: false,
  error: {
    code: err.code,
    message: err.message,
    details: err.details,
    requestId: req.id,
  },
});

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let apiErr = err;

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    apiErr = new ApiError('VALIDATION_ERROR', undefined, details);
  } else if (err instanceof mongoose.Error.CastError) {
    apiErr = new ApiError('INVALID_ID', `Invalid ${err.path}: ${err.value}`);
  } else if (err && err.code === 11000) {
    apiErr = new ApiError('VALIDATION_ERROR', 'Duplicate value violates unique constraint', [
      { field: Object.keys(err.keyValue || {})[0], message: 'already exists' },
    ]);
  } else if (err instanceof jwt.TokenExpiredError) {
    apiErr = new ApiError('TOKEN_EXPIRED');
  } else if (err instanceof jwt.JsonWebTokenError) {
    apiErr = new ApiError('TOKEN_INVALID');
  } else if (!(err instanceof ApiError)) {
    apiErr = new ApiError('INTERNAL_ERROR', env.isProd ? undefined : err.message);
  }

  const status = apiErr.status || ERROR_CODES.INTERNAL_ERROR.status;

  if (status >= 500) {
    logger.error({ err, requestId: req.id, route: req.originalUrl, userId: req.user?._id }, 'request failed');
  } else {
    logger.debug({ code: apiErr.code, requestId: req.id, route: req.originalUrl }, 'request rejected');
  }

  const body = buildBody(apiErr, req);
  if (!env.isProd && status >= 500) body.error.stack = err.stack;

  res.status(status).json(body);
};

module.exports = errorHandler;
