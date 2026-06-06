const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Team Task Management API',
      version: '1.0.0',
      description: 'Backend REST API — xem docs/Backend_Features_and_API_Spec.md',
    },
    servers: [
      { url: `http://localhost:${env.PORT}/api`, description: 'Local' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {},
            meta: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: {},
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, '../modules/**/*.route.js'),
    path.join(__dirname, '../modules/**/*.docs.js'),
  ],
});

module.exports = swaggerSpec;
