const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const auth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or invalid Authorization header'));
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    return next();
  } catch (_err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Unauthorized'));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden: insufficient permissions'));
  }
  return next();
};

module.exports = { auth, requireRole };
