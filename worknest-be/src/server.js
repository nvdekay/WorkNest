require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');

const start = async () => {
  try {
    await connectDB();
    app.listen(env.PORT, () => {
      console.log(`[server] running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
      console.log(`[swagger] docs at  http://localhost:${env.PORT}/api-docs`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
};

start();

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
