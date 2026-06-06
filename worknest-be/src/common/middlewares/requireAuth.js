const ApiError = require('../errors/ApiError');
const { verifyAccessToken } = require('../utils/jwt');

const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError('UNAUTHENTICATED');
    }
    const payload = verifyAccessToken(header.slice(7));
    // Service layer sẽ load User document khi cần — middleware chỉ giữ id và payload.
    req.auth = payload;
    req.user = { _id: payload.sub, id: payload.sub };
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = requireAuth;
