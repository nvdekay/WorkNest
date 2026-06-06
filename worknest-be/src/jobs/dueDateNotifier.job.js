// Hằng ngày: phát TASK_DUE_SOON (đến hạn trong 24h, chưa DONE) và TASK_OVERDUE.
// TODO: thực hiện cron daily, gọi notification.service.emit() cho từng assignee.

const run = async () => {
  // throw new Error('dueDateNotifier.job not implemented');
};

module.exports = { run, schedule: '0 8 * * *' }; // 08:00 mỗi ngày
