const logger = require('../../config/logger');
const Activity = require('./activity.model');

// list — TODO (sẽ implement khi làm module Activities phía read).
const list = async (_workspaceId, _query) => { throw new Error('not implemented'); };

// Fire-and-forget: lỗi log không bao giờ chặn caller.
// payload: { workspaceId, projectId?, taskId?, actorId, type, entityLabel?, metadata? }
const log = async (payload) => {
  try {
    await Activity.create(payload);
  } catch (err) {
    logger.error({ err, payload }, '[activity] failed to log');
  }
};

module.exports = { list, log };
