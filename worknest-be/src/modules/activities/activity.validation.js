const Joi = require('joi');
const { ACTIVITY_TYPE_VALUES } = require('../../common/constants');

const list = {
  query: Joi.object({
    projectId: Joi.string().hex().length(24),
    taskId: Joi.string().hex().length(24),
    actorId: Joi.string().hex().length(24),
    type: Joi.string().valid(...ACTIVITY_TYPE_VALUES),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sort: Joi.string(),
  }),
};

module.exports = { list };
