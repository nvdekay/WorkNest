const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

const connectDB = async () => {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => logger.error({ err }, '[mongo] connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('[mongo] disconnected'));
  const conn = await mongoose.connect(env.MONGO_URI);
  logger.info(`[mongo] connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

const disconnectDB = () => mongoose.disconnect();

module.exports = { connectDB, disconnectDB };
