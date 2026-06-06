const Joi = require('joi');

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

module.exports = { send, accept, preview };
