const Joi = require('joi');
const { ROLE_VALUES, MEMBER_STATUS_VALUES } = require('../../common/constants');

const list = {
  query: Joi.object({
    search: Joi.string().trim().max(80),
    role: Joi.string().valid(...ROLE_VALUES),
    status: Joi.string().valid(...MEMBER_STATUS_VALUES),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sort: Joi.string(),
  }),
};

const updateRole = {
  body: Joi.object({
    role: Joi.string().valid('ADMIN', 'MEMBER').required(),
  }),
};

module.exports = { list, updateRole };
