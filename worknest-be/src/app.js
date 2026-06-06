const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');

const requestId = require('./common/utils/requestId');
const { globalLimiter } = require('./common/middlewares/rateLimiter');
const errorHandler = require('./common/middlewares/errorHandler');
const notFound = require('./common/middlewares/notFound');

const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// --- Basic plumbing ---
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize({ replaceWith: '_' }));

if (!env.isTest) {
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );
}

// --- Static uploads (avatars, attachments) ---
app.use('/uploads', express.static(env.UPLOAD_DIR, { index: false, dotfiles: 'deny' }));

// --- Health & docs ---
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { explorer: true, customSiteTitle: 'Team Task Management API Docs' })
);
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// --- API ---
app.use('/api', globalLimiter, routes);

// --- Tail ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
