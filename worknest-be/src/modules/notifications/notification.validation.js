const Joi = require('joi');
const { NOTIFICATION_TYPE_VALUES } = require('../../common/constants');

const list = {
  query: Joi.object({
    workspaceId: Joi.string().hex().length(24),
    unread: Joi.string().valid('true', 'false'),
    type: Joi.string().valid(...NOTIFICATION_TYPE_VALUES),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sort: Joi.string(),
  }),
};

const unreadCount = {
  query: Joi.object({ workspaceId: Joi.string().hex().length(24) }),
};

const readAll = {
  body: Joi.object({ workspaceId: Joi.string().hex().length(24) }),
};

module.exports = { list, unreadCount, readAll };
