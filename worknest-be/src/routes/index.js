const express = require('express');
const userRoute = require('../modules/user/user.route');
const authRoute = require('../modules/auth/auth.route');

const router = express.Router();

router.use('/auth', authRoute);
router.use('/users', userRoute);

module.exports = router;
