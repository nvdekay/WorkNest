const express = require('express');
const authController = require('./auth.controller');
const authValidation = require('./auth.validation');
const validate = require('../../middlewares/validate.middleware');
const { auth } = require('../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Khanh }
 *               email: { type: string, format: email, example: khanh@example.com }
 *               password: { type: string, minLength: 6, example: secret123 }
 *     responses:
 *       201:
 *         description: Registered
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *                         token: { type: string }
 *       409: { description: Email already in use }
 */
router.post('/register', validate(authValidation.register), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email & password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Logged in
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *                         token: { type: string }
 *       401: { description: Invalid credentials }
 */
router.post('/login', validate(authValidation.login), authController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user from JWT
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 *       401: { description: Unauthorized }
 */
router.get('/me', auth, authController.me);

module.exports = router;
