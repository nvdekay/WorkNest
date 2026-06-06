const pino = require('pino');
const env = require('./env');

const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.passwordHash', '*.token', '*.refreshToken'],
    censor: '[REDACTED]',
  },
  transport: env.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } },
});

module.exports = logger;
