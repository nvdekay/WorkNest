const mongoose = require('mongoose');
const ApiError = require('../errors/ApiError');

// Middleware sinh sẵn cho route :paramName — kiểm tra ObjectId hợp lệ.
const validateObjectId = (...paramNames) => (req, _res, next) => {
  for (const name of paramNames) {
    const value = req.params[name];
    if (value !== undefined && !mongoose.isValidObjectId(value)) {
      return next(new ApiError('INVALID_ID', `Invalid id format for "${name}".`));
    }
  }
  return next();
};

module.exports = validateObjectId;
