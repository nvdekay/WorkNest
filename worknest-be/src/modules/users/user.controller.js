const notImpl = require('../../common/utils/notImpl');

module.exports = {
  getMe: notImpl('GET /users/me'),
  updateMe: notImpl('PATCH /users/me'),
  uploadAvatar: notImpl('POST /users/me/avatar'),
};
