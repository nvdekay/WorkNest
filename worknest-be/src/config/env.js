require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/worknest',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

const required = ['MONGO_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!env[key]) {
    throw new Error(`[env] Missing required environment variable: ${key}`);
  }
}

module.exports = env;
