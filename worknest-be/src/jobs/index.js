const cron = require('node-cron');
const logger = require('../config/logger');

const dueDateNotifier = require('./dueDateNotifier.job');
const invitationSweeper = require('./invitationSweeper.job');
const purge = require('./purge.job');

const jobs = [
  { name: 'dueDateNotifier', ...dueDateNotifier },
  { name: 'invitationSweeper', ...invitationSweeper },
  { name: 'purge', ...purge },
];

const startJobs = () => {
  for (const job of jobs) {
    cron.schedule(job.schedule, async () => {
      try {
        await job.run();
      } catch (err) {
        logger.error({ err, job: job.name }, '[jobs] failed');
      }
    });
    logger.info(`[jobs] scheduled ${job.name} → ${job.schedule}`);
  }
};

module.exports = { startJobs };
