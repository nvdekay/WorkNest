const Joi = require('joi');

const create = {
  body: Joi.object({
    body: Joi.string().trim().min(1).max(5000).required(),
    parentId: Joi.string().hex().length(24),
  }),
};

const update = {
  body: Joi.object({
    body: Joi.string().trim().min(1).max(5000).required(),
  }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sort: Joi.string(),
  }),
};

module.exports = { create, update, list };
