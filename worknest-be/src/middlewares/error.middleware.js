const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate field value: ${JSON.stringify(err.keyValue)}`;
  }

  if (!(err instanceof ApiError) && env.NODE_ENV !== 'production') {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = errorHandler;
