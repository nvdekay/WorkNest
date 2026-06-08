const logger = require('../config/logger');
const Invitation = require('../modules/workspaces/invitation.model');
const { INVITATION_STATUS } = require('../common/constants');

// Hết hạn các invitation PENDING quá expiresAt → status EXPIRED.
const run = async () => {
  try {
    const res = await Invitation.updateMany(
      { status: INVITATION_STATUS.PENDING, expiresAt: { $lt: new Date() } },
      { $set: { status: INVITATION_STATUS.EXPIRED } }
    );
    if (res.modifiedCount) {
      logger.info({ modified: res.modifiedCount }, '[invitationSweeper] expired pending invitations');
    }
  } catch (err) {
    logger.error({ err }, '[invitationSweeper] failed');
  }
};

module.exports = { run, schedule: '*/15 * * * *' }; // mỗi 15 phút
