require('dotenv').config();
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/db');

let server;

const start = async () => {
  try {
    await connectDB();
    server = app.listen(env.PORT, () => {
      logger.info(`[server] running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
      logger.info(`[swagger] docs at  http://localhost:${env.PORT}/api-docs`);
    });
  } catch (err) {
    logger.error({ err }, '[server] failed to start');
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info(`[server] received ${signal}, shutting down...`);
  if (server) server.close();
  await disconnectDB().catch((err) => logger.error({ err }, '[mongo] disconnect failed'));
  process.exit(0);
};

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, '[unhandledRejection]'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '[uncaughtException]');
  process.exit(1);
});

start();
