const notImpl = require('../../common/utils/notImpl');

module.exports = {
  list: notImpl('GET /tasks/:taskId/comments'),
  create: notImpl('POST /tasks/:taskId/comments'),
  update: notImpl('PATCH /comments/:commentId'),
  remove: notImpl('DELETE /comments/:commentId'),
};
