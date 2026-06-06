const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

const signAccessToken = (userId, extra = {}) =>
  jwt.sign({ sub: String(userId), ...extra }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });

const signRefreshToken = (userId, jti = crypto.randomUUID(), extra = {}) =>
  jwt.sign({ sub: String(userId), jti, ...extra }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  });

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
