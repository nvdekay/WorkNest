const rateLimit = require('express-rate-limit');
const env = require('../../config/env');

const buildHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please slow down.',
      requestId: req.id,
    },
  });
};

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler,
});

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler,
});

module.exports = { globalLimiter, authLimiter };
