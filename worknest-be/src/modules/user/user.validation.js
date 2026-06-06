const Joi = require('joi');

const create = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('user', 'admin'),
  }),
};

const update = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    role: Joi.string().valid('user', 'admin'),
  }).min(1),
};

const byId = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

module.exports = { create, update, byId, list };
