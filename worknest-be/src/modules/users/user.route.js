const express = require('express');
const validate = require('../../common/middlewares/validate');
const requireAuth = require('../../common/middlewares/requireAuth');
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

router.get('/me', controller.getMe);
router.patch('/me', validate(v.updateMe), controller.updateMe);
router.post('/me/avatar', controller.uploadAvatar); // multipart, multer sẽ gắn sau

module.exports = router;
