const Joi = require('joi');
const { TASK_STATUS_VALUES } = require('../../common/constants');

const statusEntry = Joi.object({
  key: Joi.string().valid(...TASK_STATUS_VALUES).required(),
  label: Joi.string().min(1).max(30).required(),
  order: Joi.number().integer().min(0).required(),
});

const create = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    description: Joi.string().max(1000).allow(null, ''),
    key: Joi.string().uppercase().pattern(/^[A-Z0-9]{2,6}$/),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  }),
};

const update = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    description: Joi.string().max(1000).allow(null, ''),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    statuses: Joi.array().items(statusEntry).length(4),
  }).min(1),
};

const archive = {
  body: Joi.object({ archived: Joi.boolean().required() }),
};

const list = {
  query: Joi.object({
    search: Joi.string().trim().max(80),
    archived: Joi.string().valid('true', 'false', 'all'),
    sort: Joi.string(),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

module.exports = { create, update, archive, list };
