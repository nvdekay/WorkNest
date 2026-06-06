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
 */

router.post('/register', authLimiter, validate(v.register), controller.register);
router.post('/login', authLimiter, validate(v.login), controller.login);
router.post('/refresh', authLimiter, validate(v.refresh), controller.refresh);
router.post('/logout', requireAuth, validate(v.logout), controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, validate(v.changePassword), controller.changePassword);

module.exports = router;
