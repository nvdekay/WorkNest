const Joi = require('joi');
const { INVITATION_STATUS_VALUES } = require('../../common/constants');

const send = {
  body: Joi.object({
    email: Joi.string().email().lowercase().required(),
    role: Joi.string().valid('ADMIN', 'MEMBER').required(),
  }),
};

const accept = {
  body: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
};

const preview = {
  query: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
};

const list = {
  query: Joi.object({
    status: Joi.string().valid(...INVITATION_STATUS_VALUES),
    search: Joi.string().trim().max(254),
    sort: Joi.string(),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

module.exports = { send, accept, preview, list };
