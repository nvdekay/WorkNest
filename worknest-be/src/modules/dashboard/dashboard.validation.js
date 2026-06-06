const Joi = require('joi');

const range = {
  query: Joi.object({
    from: Joi.date().iso(),
    to: Joi.date().iso(),
  }),
};

module.exports = { range };
