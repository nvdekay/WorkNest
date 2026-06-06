const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const { authLimiter } = require('../../common/middlewares/rateLimiter');
const controller = require('./auth.controller');
const v = require('./auth.validation');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Đăng ký, đăng nhập, vòng đời JWT
 *
 * components:
 *   schemas:
 *     AuthUser:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         name: { type: string }
 *         email: { type: string, format: email }
 *         avatarUrl: { type: string, nullable: true }
 *     AuthTokens:
 *       type: object
 *       properties:
 *         user: { $ref: '#/components/schemas/AuthUser' }
 *         accessToken: { type: string }
 *         refreshToken: { type: string }
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Tạo tài khoản
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 60, example: Khanh }
 *               email: { type: string, format: email, example: khanh@example.com }
 *               password: { type: string, minLength: 8, maxLength: 72, example: Secret123 }
 *     responses:
 *       201: { description: Đã tạo, kèm cặp token }
 *       409: { description: EMAIL_TAKEN }
 *       422: { description: VALIDATION_ERROR }
 *       429: { description: RATE_LIMITED }
 */
router.post('/register', authLimiter, validate(v.register), controller.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập email + password
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
 *       200: { description: OK, kèm cặp token }
 *       401: { description: INVALID_CREDENTIALS }
 *       422: { description: VALIDATION_ERROR }
 *       429: { description: RATE_LIMITED }
 */
router.post('/login', authLimiter, validate(v.login), controller.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Đổi access token mới, xoay vòng refresh
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Cặp token mới }
 *       401: { description: TOKEN_INVALID | TOKEN_EXPIRED }
 */
router.post('/refresh', authLimiter, validate(v.refresh), controller.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Vô hiệu refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: '{ loggedOut: true }' }
 *       401: { description: UNAUTHENTICATED }
 */
router.post('/logout', requireAuth, validate(v.logout), controller.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin user hiện tại + danh sách workspace
 *     responses:
 *       200: { description: '{ user, workspaces: [{ _id, name, role }] }' }
 *       401: { description: UNAUTHENTICATED }
 */
router.get('/me', requireAuth, controller.me);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Đổi mật khẩu (kéo theo thu hồi tất cả refresh token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8, maxLength: 72 }
 *     responses:
 *       200: { description: '{ changed: true }' }
 *       401: { description: INVALID_CREDENTIALS }
 *       422: { description: VALIDATION_ERROR }
 */
router.post('/change-password', requireAuth, validate(v.changePassword), controller.changePassword);

module.exports = router;
