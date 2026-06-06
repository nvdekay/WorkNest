const notImpl = require('../../common/utils/notImpl');

module.exports = {
  register: notImpl('POST /auth/register'),
  login: notImpl('POST /auth/login'),
  refresh: notImpl('POST /auth/refresh'),
  logout: notImpl('POST /auth/logout'),
  me: notImpl('GET /auth/me'),
  changePassword: notImpl('POST /auth/change-password'),
};
