const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
const { avatarUpload } = require('../../common/middlewares/upload');
const controller = require('./user.controller');
const v = require('./user.validation');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: Hồ sơ của chính người dùng đang đăng nhập
 */

router.use(requireAuth);

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Lấy hồ sơ của chính mình
 *     responses:
 *       200: { description: '{ _id, name, email, avatarUrl, emailVerified }' }
 *       401: { description: UNAUTHENTICATED }
 *   patch:
 *     tags: [Users]
 *     summary: Cập nhật name / avatarUrl (email không sửa)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 60 }
 *               avatarUrl: { type: string, format: uri, nullable: true, description: chỉ https }
 *     responses:
 *       200: { description: User đã cập nhật }
 *       422: { description: VALIDATION_ERROR }
 */
router.get('/me', controller.getMe);
router.patch('/me', validate(v.updateMe), controller.updateMe);

/**
 * @openapi
 * /users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Upload avatar (png/jpeg/webp, ≤ 2 MB)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: '{ avatarUrl }' }
 *       422: { description: INVALID_FILE (sai mime hoặc quá kích thước) }
 */
router.post('/me/avatar', avatarUpload, controller.uploadAvatar);

module.exports = router;
