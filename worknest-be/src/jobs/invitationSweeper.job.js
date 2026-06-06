// Hết hạn các invitation PENDING quá expiresAt → status EXPIRED.

const run = async () => {
  // TODO: Invitation.updateMany({ status:'PENDING', expiresAt: { $lt: new Date() } }, { $set: { status:'EXPIRED' } })
};

module.exports = { run, schedule: '*/15 * * * *' }; // mỗi 15 phút
