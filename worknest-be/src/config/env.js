require('dotenv').config();

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: num(process.env.PORT, 5001),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  MONGO_URI: process.env.MONGO_URI,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '7d',

  BCRYPT_COST: num(process.env.BCRYPT_COST, 12),

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  RATE_LIMIT_WINDOW_MS: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  RATE_LIMIT_MAX: num(process.env.RATE_LIMIT_MAX, 300),
  AUTH_RATE_LIMIT_MAX: num(process.env.AUTH_RATE_LIMIT_MAX, 10),

  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_AVATAR_SIZE: num(process.env.MAX_AVATAR_SIZE, 2 * 1024 * 1024),
  MAX_ATTACHMENT_SIZE: num(process.env.MAX_ATTACHMENT_SIZE, 10 * 1024 * 1024),
};

const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!env[key]) throw new Error(`[env] Missing required environment variable: ${key}`);
}

env.isProd = env.NODE_ENV === 'production';
env.isTest = env.NODE_ENV === 'test';

module.exports = env;
